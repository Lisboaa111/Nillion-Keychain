import {
  Keypair,
  NucTokenBuilder,
  Command,
  PayerBuilder,
  Did,
} from "@nillion/nuc";
import { SecretVaultBuilderClient } from "@nillion/secretvaults";
import type {
  NillionConfig,
  DelegationRequest,
  CreateCollectionRequest,
} from "../types";
import { parseDidToBytes } from "../utils/nillion";
import { config } from "../config";

const OPERATION_COMMANDS: Record<string, string[]> = {
  create: ["nil", "db", "data", "create"],
  read: ["nil", "db", "data", "read"],
  update: ["nil", "db", "data", "update"],
  delete: ["nil", "db", "data", "delete"],
  grantAccess: ["nil", "db", "acl", "grant"],
  revokeAccess: ["nil", "db", "acl", "revoke"],
};

export class NillionService {
  private builderKeypair: Keypair | null = null;
  private builderClient: SecretVaultBuilderClient | null = null;
  private rootToken: string | null = null;
  private config: NillionConfig;
  private builderDid: string = "";
  private isInitialized: boolean = false;

  constructor(nillionConfig: NillionConfig) {
    this.config = nillionConfig;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.builderKeypair = Keypair.from(this.config.builderPrivateKey);
    this.builderDid = this.builderKeypair.toDid().toString();

    await new PayerBuilder()
      .keypair(this.builderKeypair)
      .chainUrl(this.config.nilchainUrl)
      .build();

    this.builderClient = await SecretVaultBuilderClient.from({
      keypair: this.builderKeypair,
      urls: {
        chain: this.config.nilchainUrl,
        auth: this.config.nilauthUrl,
        dbs: this.config.nildbNodes,
      },
    });

    await this.builderClient.refreshRootToken();
    this.rootToken = this.builderClient.rootToken;
    this.isInitialized = true;
  }

  getBuilderDid(): string {
    this.ensureInitialized();
    return this.builderDid;
  }

  getConfig() {
    this.ensureInitialized();
    return {
      builderDid: this.builderDid,
      nildbNodes: this.config.nildbNodes,
      nilchainUrl: this.config.nilchainUrl,
      nilauthUrl: this.config.nilauthUrl,
    };
  }

  createDelegationToken(request: DelegationRequest): string {
    this.ensureInitialized();

    const command = OPERATION_COMMANDS[request.operation];
    if (!command) {
      throw new Error(`Invalid operation: ${request.operation}`);
    }

    const publicKeyBytes = parseDidToBytes(request.userDid);
    const targetDid = new Did(publicKeyBytes);
    const expiresAt =
      Math.floor(Date.now() / 1000) + config.delegation.tokenExpirySeconds;

    return NucTokenBuilder.extending(this.rootToken!)
      .command(new Command(command))
      .audience(targetDid)
      .expiresAt(expiresAt)
      .build(this.builderKeypair!.privateKey());
  }

  async createCollection(request: CreateCollectionRequest) {
    this.ensureInitialized();

    const collection = {
      _id: request.collectionId,
      type: "owned",
      name: request.name,
      schema: request.schema,
    };

    const result = await this.builderClient!.createCollection(collection);

    return {
      collectionId: request.collectionId,
      nodesCount: Object.keys(result).length,
    };
  }

  async registerBuilder(name: string = "Nillion dApp Builder") {
    this.ensureInitialized();

    try {
      const profile = await this.builderClient!.readProfile();
      return { registered: true, name: profile.data.name };
    } catch {
      try {
        await this.builderClient!.register({
          did: this.builderDid,
          name: name,
        });
        return { registered: true, name: name };
      } catch (error: any) {
        if (error.message?.includes("duplicate key")) {
          return { registered: true, name: name };
        }
        throw error;
      }
    }
  }

  hasActiveSubscription(did: string): boolean {
    return did === this.builderDid;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.builderKeypair || !this.rootToken) {
      throw new Error("Nillion service not initialized");
    }
  }
}
