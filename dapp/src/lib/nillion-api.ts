const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export class NillionAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  async getBuilderInfo() {
    return this.request<{
      success: boolean;
      builderDid: string;
      config: {
        builderDid: string;
        nildbNodes: string[];
        nilchainUrl: string;
        nilauthUrl: string;
      };
    }>("/api/builder/info");
  }

  async registerBuilder(name: string = "Nillion dApp Builder") {
    return this.request<{
      success: boolean;
      data: {
        registered: boolean;
        name: string;
      };
    }>("/api/builder/register", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async createCollection(params: {
    collectionId: string;
    name: string;
    schema: any;
  }) {
    return this.request<{
      success: boolean;
      data: {
        collectionId: string;
        nodesCount: number;
      };
    }>("/api/collections/create", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async prepareStoreData(params: {
    userDid: string;
    collection: string;
    data: any;
    acl?: {
      grantee: string;
      read?: boolean;
      write?: boolean;
      execute?: boolean;
    };
  }) {
    return this.request<{
      success: boolean;
      delegation: string;
      builderDid: string;
      nodeUrls: string[];
    }>("/api/store/prepare", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async createDelegation(params: {
    userDid: string;
    operation:
      | "create"
      | "read"
      | "update"
      | "delete"
      | "grantAccess"
      | "revokeAccess";
    collection?: string;
  }) {
    return this.request<{
      success: boolean;
      delegation: string;
    }>("/api/delegation/create", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async prepareReadData(params: {
    userDid: string;
    collection: string;
    document: string;
  }) {
    return this.request<{
      success: boolean;
      delegation: string;
      nodeUrls: string[];
    }>("/api/data/prepare-read", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async prepareGrantAccess(params: {
    userDid: string;
    collection: string;
    document: string;
  }) {
    return this.request<{
      success: boolean;
      delegation: string;
      nodeUrls: string[];
      collection: string;
      document: string;
    }>("/api/delegation/grant-access", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async prepareRevokeAccess(params: {
    userDid: string;
    collection: string;
    document: string;
  }) {
    return this.request<{
      success: boolean;
      delegation: string;
      nodeUrls: string[];
      collection: string;
      document: string;
    }>("/api/delegation/revoke-access", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async checkSubscription(did: string) {
    return this.request<{
      success: boolean;
      did: string;
      hasSubscription: boolean;
      message: string;
    }>(`/api/subscription/status/${did}`);
  }
}

export const nillionAPI = new NillionAPI();
