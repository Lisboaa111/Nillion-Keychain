import { useState, useEffect } from "react";
import { nillionAPI } from "./lib/nillion-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wallet,
  Database,
  Lock,
  Server,
  RefreshCw,
  Trash2,
  Eye,
  Copy,
  X,
  Key,
  UserPlus,
  Plus,
  Minus,
  Shield,
  ShieldOff,
} from "lucide-react";

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "error";
}

interface StoredItem {
  collection: string;
  document: string;
  timestamp: string;
  name: string;
}

interface DataField {
  id: string;
  name: string;
  value: string;
  encrypted: boolean;
}

const DEFAULT_COLLECTION_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "array",
  uniqueItems: true,
  items: {
    type: "object",
    properties: {
      _id: { type: "string", format: "uuid" },
      name: { type: "string" },
      apiKey: {
        type: "object",
        properties: {
          "%share": { type: "string" },
        },
        required: ["%share"],
      },
    },
    required: ["_id", "name", "apiKey"],
  },
};

export default function App() {
  const [collectionId] = useState("fc6b3739-67cd-4454-b3bf-0068fe98caab");
  const [userDid, setUserDid] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStoring, setIsStoring] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [builderInfo, setBuilderInfo] = useState<any>(null);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "connected" | "error"
  >("checking");
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [collectionExists, setCollectionExists] = useState(false);
  const [documentName, setDocumentName] = useState("My Secret Document");
  const [dataFields, setDataFields] = useState<DataField[]>([
    {
      id: crypto.randomUUID(),
      name: "apiKey",
      value: "sk_live_123456789",
      encrypted: true,
    },
    {
      id: crypto.randomUUID(),
      name: "username",
      value: "john_doe",
      encrypted: false,
    },
  ]);
  const [viewingDocument, setViewingDocument] = useState<any>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [showAclModal, setShowAclModal] = useState(false);
  const [newGranteeDid, setNewGranteeDid] = useState("");
  const [newPermissions, setNewPermissions] = useState({
    read: true,
    write: false,
    execute: false,
  });

  const addLog = (
    message: string,
    type: "info" | "success" | "error" = "info"
  ) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [{ timestamp, message, type }, ...prev].slice(0, 100));
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
  };

  useEffect(() => {
    const checkBackend = async () => {
      try {
        addLog("Checking backend connection...", "info");
        const info = await nillionAPI.getBuilderInfo();
        setBuilderInfo(info);
        setBackendStatus("connected");
        addLog(
          `✅ Backend connected! Builder DID: ${info.builderDid.substring(
            0,
            40
          )}...`,
          "success"
        );
      } catch (error: any) {
        setBackendStatus("error");
        addLog(`❌ Backend connection failed: ${error.message}`, "error");
      }
    };
    checkBackend();
  }, []);

  useEffect(() => {
    const checkExtension = () => {
      if (window.nillion) {
        addLog("✅ Nillion Wallet extension detected!", "success");
        if (window.nillion.isConnected && window.nillion.userDid) {
          setUserDid(window.nillion.userDid);
          setIsConnected(true);
          addLog(
            `✅ Already connected! User DID: ${window.nillion.userDid.substring(
              0,
              40
            )}...`,
            "success"
          );
        }
      } else {
        addLog("⚠️ Nillion Wallet extension not detected", "error");
      }
    };

    if (document.readyState === "complete") {
      checkExtension();
    }

    const timer = setTimeout(checkExtension, 1000);
    window.addEventListener("nillion#initialized", checkExtension);

    const handleDisconnect = () => {
      setUserDid(null);
      setIsConnected(false);
      addLog("🔌 Disconnected from wallet", "info");
    };
    window.addEventListener("nillion:disconnected", handleDisconnect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("nillion#initialized", checkExtension);
      window.removeEventListener("nillion:disconnected", handleDisconnect);
    };
  }, []);

  useEffect(() => {
    if (isConnected) {
      loadStoredItems();
    }
  }, [isConnected]);

  const addField = () => {
    setDataFields([
      ...dataFields,
      {
        id: crypto.randomUUID(),
        name: "",
        value: "",
        encrypted: true,
      },
    ]);
  };

  const removeField = (id: string) => {
    if (dataFields.length <= 1) {
      addLog("❌ Must have at least one field", "error");
      return;
    }
    setDataFields(dataFields.filter((field) => field.id !== id));
  };

  const updateField = (id: string, updates: Partial<Omit<DataField, "id">>) => {
    setDataFields(
      dataFields.map((field) =>
        field.id === id ? { ...field, ...updates } : field
      )
    );
  };

  const toggleEncryption = (id: string) => {
    setDataFields(
      dataFields.map((field) =>
        field.id === id ? { ...field, encrypted: !field.encrypted } : field
      )
    );
  };

  const handleConnect = async () => {
    if (!window.nillion) {
      addLog("❌ Nillion Wallet extension not found!", "error");
      alert(
        "Please install the Nillion Wallet extension and refresh the page."
      );
      return;
    }

    try {
      addLog("🔄 Requesting wallet connection...", "info");
      const result = await window.nillion.connect();
      setUserDid(result.did);
      setIsConnected(true);
      addLog(
        `✅ Connected! User DID: ${result.did.substring(0, 40)}...`,
        "success"
      );
    } catch (error: any) {
      addLog(`❌ Connection failed: ${error.message}`, "error");
    }
  };

  const handleDisconnect = async () => {
    if (!window.nillion) return;

    try {
      await window.nillion.disconnect();
      setUserDid(null);
      setIsConnected(false);
      setStoredItems([]);
      addLog("🔌 Disconnected from wallet", "info");
    } catch (error: any) {
      addLog(`❌ Disconnect failed: ${error.message}`, "error");
    }
  };

  const handleCreateCollection = async () => {
    if (backendStatus !== "connected") {
      addLog("❌ Backend not connected!", "error");
      return;
    }

    setIsCreatingCollection(true);

    try {
      addLog(`🔄 Creating collection: ${collectionId}...`, "info");

      const result = await nillionAPI.createCollection({
        collectionId: collectionId,
        name: "Secrets Collection",
        schema: DEFAULT_COLLECTION_SCHEMA,
      });

      addLog(
        `✅ Collection created on ${result.data.nodesCount} nodes!`,
        "success"
      );
      setCollectionExists(true);
    } catch (error: any) {
      if (error.message.includes("already exists")) {
        addLog("ℹ️ Collection already exists", "info");
        setCollectionExists(true);
      } else {
        addLog(`❌ Collection creation failed: ${error.message}`, "error");
      }
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleStore = async () => {
    const validFields = dataFields.filter(
      (f) => f.name.trim() && f.value.trim()
    );

    if (validFields.length === 0) {
      addLog("❌ Please add at least one field with name and value", "error");
      return;
    }

    if (!documentName.trim()) {
      addLog("❌ Please enter a document name", "error");
      return;
    }

    if (!userDid) {
      addLog("❌ Please connect wallet first!", "error");
      return;
    }

    if (backendStatus !== "connected") {
      addLog("❌ Backend not connected!", "error");
      return;
    }

    setIsStoring(true);

    try {
      addLog(`🔄 Storing document: "${documentName}"...`, "info");

      const docId = crypto.randomUUID();

      const dataToStore: any = {
        _id: docId,
        name: documentName,
      };

      validFields.forEach((field) => {
        if (field.encrypted) {
          dataToStore[field.name] = { "%allot": field.value };
          addLog(`  🔒 ${field.name}: [encrypted]`, "info");
        } else {
          dataToStore[field.name] = field.value;
          addLog(`  📝 ${field.name}: ${field.value}`, "info");
        }
      });

      addLog("🔄 Requesting delegation token from backend...", "info");

      const prepareResponse = await nillionAPI.prepareStoreData({
        userDid: userDid,
        collection: collectionId,
        data: dataToStore,
        acl: {
          grantee: builderInfo.builderDid,
          read: true,
          write: false,
          execute: true,
        },
      });

      addLog("✅ Delegation token received from backend!", "success");

      addLog("🔄 Sending to extension for storage...", "info");
      const result = await window.nillion.storeData({
        collection: collectionId,
        data: dataToStore,
        delegation: prepareResponse.delegation,
        builderDid: prepareResponse.builderDid,
        nodeUrls: prepareResponse.nodeUrls,
        acl: {
          grantee: prepareResponse.builderDid,
          read: true,
          write: false,
          execute: true,
        },
      });

      addLog("🎉 Document stored successfully!", "success");
      addLog(`   Collection: ${result.collection}`, "info");
      addLog(`   Document: ${result.document}`, "info");
      addLog(
        `   Fields: ${validFields.length} (${
          validFields.filter((f) => f.encrypted).length
        } encrypted)`,
        "info"
      );
      addLog("---", "info");

      setStoredItems((prev) => [
        {
          collection: result.collection,
          document: result.document,
          timestamp: new Date().toLocaleTimeString(),
          name: documentName,
        },
        ...prev,
      ]);

      setDocumentName("My Secret Document");
      setDataFields([
        {
          id: crypto.randomUUID(),
          name: "apiKey",
          value: "",
          encrypted: true,
        },
      ]);
    } catch (error: any) {
      addLog(`❌ Store failed: ${error.message}`, "error");
      console.error("Full error:", error);
    } finally {
      setIsStoring(false);
    }
  };

  const loadStoredItems = async () => {
    if (!window.nillion || !isConnected) return;

    setIsLoadingList(true);

    try {
      addLog("🔄 Loading stored items...", "info");
      const data = await window.nillion.listData();

      if (Array.isArray(data)) {
        const items = data.map((item: any) => ({
          collection: item.collection || "unknown",
          document: item.document || item._id || "unknown",
          timestamp: new Date().toLocaleTimeString(),
          name: item.name || "Secret",
        }));

        setStoredItems(items);
        addLog(`✅ Loaded ${items.length} items`, "success");
      } else {
        setStoredItems([]);
        addLog("ℹ️ No items found", "info");
      }
    } catch (error: any) {
      addLog(`❌ Failed to load items: ${error.message}`, "error");
      setStoredItems([]);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleRetrieve = async (collection: string, document: string) => {
    if (!window.nillion || !isConnected) return;

    try {
      addLog(`🔄 Retrieving document: ${document.substring(0, 20)}...`, "info");

      const data = await window.nillion.retrieveData({
        collection,
        document,
        nodeUrls: builderInfo?.config?.nildbNodes || [],
      });

      addLog("✅ Data retrieved successfully!", "success");
      console.log("Retrieved data:", data);

      alert(
        `Retrieved Data:\n\n${JSON.stringify(
          data,
          null,
          2
        )}\n\nCheck console for full details.`
      );
    } catch (error: any) {
      addLog(`❌ Retrieve failed: ${error.message}`, "error");
    }
  };

  const handleViewDocument = async (collection: string, document: string) => {
    setLoadingDocument(true);
    try {
      const data = await window.nillion!.retrieveData({
        collection,
        document,
        nodeUrls: builderInfo?.config?.nildbNodes || [],
      });

      setViewingDocument({
        collection,
        document,
        data,
      });
    } catch (error: any) {
      addLog(`❌ Failed to load document: ${error.message}`, "error");
    } finally {
      setLoadingDocument(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!newGranteeDid || !viewingDocument) return;

    try {
      addLog("🔄 Granting access...", "info");

      await window.nillion!.grantAccess({
        collection: viewingDocument.collection,
        document: viewingDocument.document,
        grantee: newGranteeDid,
        permissions: newPermissions,
      });

      addLog("✅ Access granted successfully!", "success");
      setShowAclModal(false);
      setNewGranteeDid("");

      handleViewDocument(viewingDocument.collection, viewingDocument.document);
    } catch (error: any) {
      addLog(`❌ Failed to grant access: ${error.message}`, "error");
    }
  };

  const handleRevokeAccess = async (grantee: string) => {
    if (!viewingDocument) return;

    if (
      !confirm(`Revoke all permissions for ${grantee.substring(0, 20)}...?`)
    ) {
      return;
    }

    try {
      addLog("🔄 Revoking access...", "info");

      await window.nillion!.revokeAccess({
        collection: viewingDocument.collection,
        document: viewingDocument.document,
        grantee,
      });

      addLog("✅ Access revoked successfully!", "success");

      handleViewDocument(viewingDocument.collection, viewingDocument.document);
    } catch (error: any) {
      addLog(`❌ Failed to revoke access: ${error.message}`, "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog("📋 Copied to clipboard", "success");
  };

  const clearLogs = () => {
    setLogs([]);
    addLog("🗑️ Logs cleared", "info");
  };

  const canStore =
    isConnected &&
    backendStatus === "connected" &&
    !isStoring &&
    documentName.trim() &&
    dataFields.some((f) => f.name.trim() && f.value.trim());

  return (
    <div className="w-screen min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
              {/* <Lock className="h-6 w-6 text-white" /> */}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Nillion Keychain Dashboard
            </h1>
          </div>
          <p className="text-zinc-400 text-sm">
            Secure encrypted data storage with delegation architecture
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-gray-400">
                    <Server className="h-4 w-4 text-violet-400" />
                    Backend
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {backendStatus === "checking" && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Connecting...</span>
                    </div>
                  )}
                  {backendStatus === "connected" && builderInfo && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-400">
                          Connected
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-500">
                            Builder DID
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(builderInfo.builderDid)
                            }
                            className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-100"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="bg-zinc-950 rounded p-2 font-mono text-xs text-zinc-400 truncate">
                          {builderInfo.builderDid.substring(0, 40)}...
                        </div>
                        <div className="text-xs text-zinc-500">
                          {builderInfo.config.nildbNodes.length} nodes active
                        </div>
                      </div>
                    </div>
                  )}
                  {backendStatus === "error" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-400">
                          Offline
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Start backend server to continue
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-gray-400">
                    <Wallet className="h-4 w-4 text-violet-400" />
                    Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isConnected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-400">
                          Connected
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="bg-zinc-950 rounded px-2 py-1 font-mono text-xs text-zinc-400 truncate flex-1">
                          {userDid?.substring(0, 20)}...
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(userDid || "")}
                          className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-100"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        onClick={handleDisconnect}
                        variant="outline"
                        size="sm"
                        className="w-full bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-400">
                          Not connected
                        </span>
                      </div>
                      <Button
                        onClick={handleConnect}
                        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
                      >
                        <Wallet className="mr-2 h-4 w-4" />
                        Connect
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-400">
                  <Database className="h-5 w-5 text-violet-400" />
                  Collection
                </CardTitle>
                <CardDescription className="text-zinc-500">
                  Initialize storage collection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="bg-zinc-950 rounded px-3 py-2 font-mono text-xs text-zinc-400 flex-1 truncate">
                    {collectionId}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(collectionId)}
                    className="text-zinc-400 hover:text-zinc-100"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {collectionExists && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Collection ready</span>
                  </div>
                )}
                <Button
                  onClick={handleCreateCollection}
                  disabled={
                    backendStatus !== "connected" || isCreatingCollection
                  }
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                >
                  {isCreatingCollection ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Create Collection
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-400">
                  <Lock className="h-5 w-5 text-violet-400" />
                  Store Data
                </CardTitle>
                <CardDescription className="text-zinc-500">
                  Create encrypted documents with custom fields
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Document Name</Label>
                  <Input
                    placeholder="e.g., API Keys, Database Config"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-300">Fields</Label>
                    <Button
                      onClick={addField}
                      size="sm"
                      variant="outline"
                      className="h-8 bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {dataFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500">
                            Field {index + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => toggleEncryption(field.id)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title={
                                field.encrypted ? "Encrypted" : "Plaintext"
                              }
                            >
                              {field.encrypted ? (
                                <Shield className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <ShieldOff className="h-4 w-4 text-zinc-500" />
                              )}
                            </Button>
                            {dataFields.length > 1 && (
                              <Button
                                onClick={() => removeField(field.id)}
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Name"
                            value={field.name}
                            onChange={(e) =>
                              updateField(field.id, { name: e.target.value })
                            }
                            className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm placeholder:text-zinc-600"
                          />
                          <Input
                            placeholder="Value"
                            value={field.value}
                            onChange={(e) =>
                              updateField(field.id, { value: e.target.value })
                            }
                            type={field.encrypted ? "password" : "text"}
                            className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm placeholder:text-zinc-600"
                          />
                        </div>

                        {field.encrypted ? (
                          <Badge className="bg-emerald-950 text-emerald-400 border-emerald-900">
                            Encrypted
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
                            Plaintext
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleStore}
                  disabled={!canStore}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStoring ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Storing...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Store Document
                    </>
                  )}
                </Button>

                {!canStore && !isStoring && (
                  <p className="text-xs text-center text-zinc-500">
                    {backendStatus !== "connected"
                      ? "Waiting for backend connection"
                      : !isConnected
                      ? "Connect wallet to continue"
                      : !documentName.trim()
                      ? "Enter document name"
                      : "Add at least one field with values"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-gray-400">
                      <Database className="h-5 w-5 text-violet-400" />
                      Stored Items
                    </CardTitle>
                    <CardDescription className="text-zinc-500 mt-1">
                      {storedItems.length} documents
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadStoredItems}
                    disabled={!isConnected || isLoadingList}
                    className="text-zinc-400 hover:text-zinc-100"
                  >
                    {isLoadingList ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!isConnected ? (
                  <div className="text-center py-12">
                    <Wallet className="h-8 w-8 mx-auto mb-3 text-zinc-700" />
                    <p className="text-sm text-zinc-500">
                      Connect wallet to view
                    </p>
                  </div>
                ) : storedItems.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="h-8 w-8 mx-auto mb-3 text-zinc-700" />
                    <p className="text-sm text-zinc-500">No items yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {storedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-zinc-100 truncate">
                              {item.name}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {item.timestamp}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleViewDocument(
                                  item.collection,
                                  item.document
                                )
                              }
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-violet-400"
                              title="View & Manage"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRetrieve(item.collection, item.document)
                              }
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-violet-400"
                              title="Quick Retrieve"
                            >
                              <Database className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs font-mono text-zinc-600 truncate">
                          {item.document}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-gray-400">Activity</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearLogs}
                    disabled={logs.length === 0}
                    className="text-zinc-400 hover:text-zinc-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-zinc-950 rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs border border-zinc-800">
                  {logs.length === 0 ? (
                    <p className="text-zinc-600 text-center py-12">
                      No activity
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {logs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-zinc-600 whitespace-nowrap">
                            {log.timestamp}
                          </span>
                          <span
                            className={
                              log.type === "success"
                                ? "text-emerald-400"
                                : log.type === "error"
                                ? "text-red-400"
                                : "text-zinc-400"
                            }
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {viewingDocument && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setViewingDocument(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-violet-400" />
                Document Details
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingDocument(null)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Identifiers
                </h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-zinc-500">Document ID</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="bg-zinc-950 rounded px-3 py-2 font-mono text-xs text-zinc-400 flex-1 truncate">
                        {viewingDocument.document}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(viewingDocument.document)
                        }
                        className="text-zinc-400 hover:text-zinc-100"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-500">Collection</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="bg-zinc-950 rounded px-3 py-2 font-mono text-xs text-zinc-400 flex-1 truncate">
                        {viewingDocument.collection}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(viewingDocument.collection)
                        }
                        className="text-zinc-400 hover:text-zinc-100"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Decrypted Data
                </h3>
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
                  {Object.entries(viewingDocument.data).map(
                    ([key, value]: [string, any]) => {
                      if (key.startsWith("_")) {
                        if (key === "_acl") return null;
                        if (key === "_owner") {
                          return (
                            <div
                              key={key}
                              className="border-l-2 border-violet-500 pl-3 py-2"
                            >
                              <div className="text-xs text-zinc-500 mb-1">
                                Owner
                              </div>
                              <div className="font-mono text-xs text-zinc-300 break-all">
                                {value}
                              </div>
                            </div>
                          );
                        }
                        if (key === "_id") return null;
                      }
                      return (
                        <div
                          key={key}
                          className="border-l-2 border-purple-500 pl-3 py-2"
                        >
                          <div className="text-xs text-zinc-500 mb-1">
                            {key}
                          </div>
                          <div className="font-mono text-sm text-zinc-200 break-all">
                            {typeof value === "object"
                              ? JSON.stringify(value, null, 2)
                              : String(value)}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Access Control
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => setShowAclModal(true)}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Grant
                  </Button>
                </div>

                {viewingDocument.data._acl &&
                viewingDocument.data._acl.length > 0 ? (
                  <div className="space-y-2">
                    {viewingDocument.data._acl.map(
                      (acl: any, index: number) => (
                        <div
                          key={index}
                          className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-zinc-500 mb-2">
                                Grantee
                              </div>
                              <div className="font-mono text-xs text-zinc-400 truncate mb-3">
                                {acl.grantee.substring(0, 40)}...
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {acl.read && (
                                  <Badge className="bg-emerald-950 text-emerald-400 border-emerald-900">
                                    Read
                                  </Badge>
                                )}
                                {acl.write && (
                                  <Badge className="bg-orange-950 text-orange-400 border-orange-900">
                                    Write
                                  </Badge>
                                )}
                                {acl.execute && (
                                  <Badge className="bg-blue-950 text-blue-400 border-blue-900">
                                    Execute
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeAccess(acl.grantee)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-950"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-lg">
                    <Key className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No additional access granted</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAclModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAclModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-violet-400" />
                Grant Access
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAclModal(false)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-zinc-300">Grantee DID</Label>
                <Input
                  placeholder="did:nil:03..."
                  value={newGranteeDid}
                  onChange={(e) => setNewGranteeDid(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 font-mono text-sm mt-1 placeholder:text-zinc-600"
                />
              </div>

              <div>
                <Label className="text-zinc-300 mb-3 block">Permissions</Label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.read}
                      onChange={(e) =>
                        setNewPermissions({
                          ...newPermissions,
                          read: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-zinc-300">Read</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.write}
                      onChange={(e) =>
                        setNewPermissions({
                          ...newPermissions,
                          write: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-zinc-300">Write</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.execute}
                      onChange={(e) =>
                        setNewPermissions({
                          ...newPermissions,
                          execute: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-zinc-300">Execute</span>
                  </label>
                </div>
              </div>

              <Button
                onClick={handleGrantAccess}
                disabled={!newGranteeDid}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white disabled:opacity-50"
              >
                Grant Access
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
