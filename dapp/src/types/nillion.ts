export interface NillionProvider {
  isConnected: boolean;
  userDid: string | null;
  connect: () => Promise<{ did: string }>;
  disconnect: () => Promise<void>;
  storeData: (params: StoreDataParams) => Promise<StoreDataResult>;
  retrieveData: (params: RetrieveDataParams) => Promise<any>;
  listData: () => Promise<DataReference[]>;
  grantAccess: (params: GrantAccessParams) => Promise<void>;
  revokeAccess: (params: RevokeAccessParams) => Promise<void>;
}

export interface StoreDataParams {
  collection: string;
  data: any;
  delegation: string;
  builderDid: string;
  nodeUrls: string[];
  acl?: {
    grantee: string;
    read?: boolean;
    write?: boolean;
    execute?: boolean;
  };
}

export interface StoreDataResult {
  success: boolean;
  collection: string;
  document: string;
  message?: string;
}

export interface RetrieveDataParams {
  collection: string;
  document: string;
  nodeUrls: string[];
}

export interface GrantAccessParams {
  collection: string;
  document: string;
  grantee: string;
  permissions: {
    read?: boolean;
    write?: boolean;
    execute?: boolean;
  };
  delegation: string;
  nodeUrls: string[];
}

export interface RevokeAccessParams {
  collection: string;
  document: string;
  grantee: string;
  delegation: string;
  nodeUrls: string[];
}

export interface DataReference {
  collection: string;
  document: string;
  owner: string;
}

declare global {
  interface Window {
    nillion?: NillionProvider;
  }
}
