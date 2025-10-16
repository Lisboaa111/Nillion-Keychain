export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  world: "MAIN",

  main() {
    class NillionProvider {
      private id = 0;
      private pending = new Map();
      public isConnected = false;
      public userDid: string | null = null;

      constructor() {
        document.addEventListener("NILLION_RESPONSE", (e: any) => {
          const { id, response } = e.detail;
          const p = this.pending.get(id);
          if (p) {
            response.success
              ? p.resolve(response)
              : p.reject(new Error(response.error));
            this.pending.delete(id);
          }
        });

        document.addEventListener("NILLION_FORCE_DISCONNECT", () => {
          this.isConnected = false;
          this.userDid = null;
          window.dispatchEvent(
            new CustomEvent("nillion:disconnected", {
              detail: { reason: "Disconnected by user" },
            })
          );
        });

        this.check();
      }

      private async check() {
        try {
          const r = await this.request("NILLION_CHECK_CONNECTION");
          if (r.connected) {
            this.isConnected = true;
            this.userDid = r.did;
          }
        } catch (e) {}
      }

      private async request(type: string, payload?: any): Promise<any> {
        const id = ++this.id;
        return new Promise((res, rej) => {
          this.pending.set(id, { resolve: res, reject: rej });
          document.dispatchEvent(
            new CustomEvent("NILLION_REQUEST", {
              detail: { id, type, payload },
            })
          );
          setTimeout(() => {
            if (this.pending.has(id)) {
              this.pending.delete(id);
              rej(new Error("Timeout"));
            }
          }, 60000);
        });
      }

      async connect() {
        const r = await this.request("NILLION_CONNECT");
        this.isConnected = true;
        this.userDid = r.did;
        return { did: r.did };
      }

      async getDid() {
        const r = await this.request("NILLION_GET_DID");
        return r.did;
      }

      async storeData(params: {
        collection: string;
        data: any;
        nodeUrls?: string[];
        acl?: any;
      }) {
        if (!this.isConnected) throw new Error("Not connected");
        if (!params.collection || !params.data)
          throw new Error("collection and data required");
        const r = await this.request("NILLION_STORE_DATA", params);
        return r.result;
      }

      async retrieveData(params: {
        collection: string;
        document: string;
        nodeUrls?: string[];
      }) {
        if (!this.isConnected) throw new Error("Not connected");
        if (!params.collection || !params.document)
          throw new Error("collection and document required");
        const r = await this.request("NILLION_RETRIEVE_DATA", params);
        return r.data;
      }

      async grantAccess(params: {
        collection: string;
        document: string;
        grantee: string;
        permissions: any;
        delegation: string;
        nodeUrls: string[];
      }) {
        if (!this.isConnected) throw new Error("Not connected");
        if (
          !params.collection ||
          !params.document ||
          !params.grantee ||
          !params.delegation
        )
          throw new Error("Missing required fields");
        const r = await this.request("NILLION_GRANT_ACCESS", params);
        return r;
      }

      async revokeAccess(params: {
        collection: string;
        document: string;
        grantee: string;
        delegation: string;
        nodeUrls: string[];
      }) {
        if (!this.isConnected) throw new Error("Not connected");
        if (
          !params.collection ||
          !params.document ||
          !params.grantee ||
          !params.delegation
        )
          throw new Error("Missing required fields");
        const r = await this.request("NILLION_REVOKE_ACCESS", params);
        return r;
      }

      async listData(params?: { nodeUrls?: string[] }) {
        if (!this.isConnected) throw new Error("Not connected");
        const r = await this.request("NILLION_LIST_DATA", params || {});
        return r.data;
      }

      async disconnect() {
        try {
          await this.request("NILLION_DISCONNECT");
          this.isConnected = false;
          this.userDid = null;
        } catch (e) {
          throw e;
        }
      }
    }

    // @ts-ignore
    window.nillion = new NillionProvider();
    window.dispatchEvent(new Event("nillion#initialized"));
  },
});
