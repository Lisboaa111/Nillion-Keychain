export interface NillionConfig {
  builderPrivateKey: string;
  nilchainUrl: string;
  nilauthUrl: string;
  nildbNodes: string[];
}

export type OperationType =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "grantAccess"
  | "revokeAccess";

export interface DelegationRequest {
  userDid: string;
  operation: OperationType;
  collection?: string;
}

export interface CreateCollectionRequest {
  collectionId: string;
  name: string;
  schema: any;
}

export interface StoreDataRequest {
  userDid: string;
  collection: string;
  data: any;
  acl?: {
    grantee: string;
    read?: boolean;
    write?: boolean;
    execute?: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DelegationResponse {
  success: boolean;
  delegation: string;
  nodeUrls?: string[];
  builderDid?: string;
  collection?: string;
  document?: string;
}

export interface BuilderInfo {
  success: boolean;
  builderDid: string;
  config: {
    builderDid: string;
    nildbNodes: string[];
    nilchainUrl: string;
    nilauthUrl: string;
  };
}

export interface SubscriptionStatus {
  success: boolean;
  did: string;
  hasSubscription: boolean;
  message: string;
}
