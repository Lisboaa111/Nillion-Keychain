import { useState, useEffect } from "react";
import { Keypair } from "@nillion/nuc";
import { SecretVaultUserClient } from "@nillion/secretvaults";
import { encryptData, decryptData, validatePassword } from "./crypto";
import "./App.css";

const NODES = [
  "https://nildb-stg-n1.nillion.network",
  "https://nildb-stg-n2.nillion.network",
  "https://nildb-stg-n3.nillion.network",
];

interface Doc {
  collection: string;
  document: string;
  owner: string;
  data?: any;
}

interface ACL {
  grantee: string;
  read: boolean;
  write: boolean;
  execute: boolean;
}

type AppScreen = "loading" | "onboard" | "setup-password" | "lock" | "main";

function App() {
  const [screen, setScreen] = useState<AppScreen>("loading");
  const [wallet, setWallet] = useState({ has: false, did: "", key: "" });
  const [tab, setTab] = useState<"wallet" | "documents" | "approve">("wallet");
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [view, setView] = useState<"pretty" | "raw">("pretty");
  const [modal, setModal] = useState<"acl" | "add" | null>(null);
  const [editAcl, setEditAcl] = useState<ACL | null>(null);
  const [newDid, setNewDid] = useState("");
  const [perms, setPerms] = useState({
    read: true,
    write: false,
    execute: false,
  });
  const [sites, setSites] = useState<string[]>([]);
  const [sub, setSub] = useState<{ has: boolean; msg: string } | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [pendingKeypair, setPendingKeypair] = useState<{
    privateKey: string;
    did: string;
  } | null>(null);

  useEffect(() => {
    checkWalletStatus();
    checkRequest();
    loadSites();
  }, []);

  useEffect(() => {
    if (wallet.has && wallet.did && screen === "main") {
      checkSub();
    }
  }, [wallet.has, wallet.did, screen]);

  useEffect(() => {
    if (wallet.has && docs.length === 0 && screen === "main") {
      loadDocs();
    }
  }, [wallet.has, screen]);

  const checkWalletStatus = async () => {
    try {
      const r = await chrome.storage.local.get([
        "nillion_encrypted_key",
        "nillion_salt",
        "nillion_iv",
        "nillion_did",
        "nillion_unlocked",
      ]);

      if (r.nillion_encrypted_key) {
        if (r.nillion_unlocked === true) {
          const sessionKey = await chrome.storage.session?.get(
            "nillion_session_key"
          );
          if (sessionKey?.nillion_session_key) {
            setWallet({ has: true, did: r.nillion_did || "", key: "" });
            setScreen("main");
          } else {
            setScreen("lock");
          }
        } else {
          setScreen("lock");
        }
      } else {
        setScreen("onboard");
      }
    } catch (e) {
      console.error("Error checking wallet:", e);
      setScreen("onboard");
    }
    setLoading(false);
  };

  const checkSub = async () => {
    try {
      const r = await fetch(
        "http://localhost:3001/api/subscription/status/" + wallet.did
      );
      const d = await r.json();
      if (d.success) setSub({ has: d.hasSubscription, msg: d.message });
    } catch (e) {
      setSub({ has: false, msg: "Unable to check" });
    }
  };

  const loadSites = async () => {
    try {
      const r = await chrome.runtime.sendMessage({
        type: "GET_CONNECTED_SITES",
      });
      if (r.success) setSites(r.sites);
    } catch (e) {}
  };

  const loadDocs = async () => {
    setBusy(true);
    try {
      const sessionKey = await chrome.storage.session?.get(
        "nillion_session_key"
      );
      if (!sessionKey?.nillion_session_key) {
        setScreen("lock");
        return;
      }

      const kp = Keypair.from(sessionKey.nillion_session_key);
      const user = await SecretVaultUserClient.from({
        baseUrls: NODES,
        keypair: kp,
        blindfold: { operation: "store" },
      });
      const res = await user.listDataReferences();
      setDocs(res.data || []);
    } catch (e) {
      console.error("Error loading docs:", e);
    }
    setBusy(false);
  };

  const loadDoc = async (doc: Doc) => {
    try {
      setSelected({ ...doc, data: "Loading..." });
      const sessionKey = await chrome.storage.session?.get(
        "nillion_session_key"
      );
      if (!sessionKey?.nillion_session_key) {
        setScreen("lock");
        return;
      }

      const kp = Keypair.from(sessionKey.nillion_session_key);
      const user = await SecretVaultUserClient.from({
        baseUrls: NODES,
        keypair: kp,
        blindfold: { operation: "store" },
      });
      const res = await user.readData({
        collection: doc.collection,
        document: doc.document,
      });
      setSelected({ ...doc, data: res.data });
    } catch (e: any) {
      setSelected({ ...doc, data: { error: e.message } });
    }
  };

  const createWallet = async () => {
    try {
      const kp = Keypair.generate();
      const pk = kp.privateKey();
      const key =
        typeof pk === "string"
          ? pk
          : Array.from(pk as Uint8Array)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
      const did = kp.toDid().toString();

      setPendingKeypair({ privateKey: key, did });
      setScreen("setup-password");
    } catch (e) {
      console.error("Error creating wallet:", e);
    }
  };

  const importWallet = async () => {
    const key = prompt("Enter private key:");
    if (!key) return;
    try {
      const kp = Keypair.from(key);
      const did = kp.toDid().toString();

      setPendingKeypair({ privateKey: key, did });
      setScreen("setup-password");
    } catch (e) {
      alert("Invalid private key");
    }
  };

  const setupPassword = async () => {
    setPasswordError("");

    if (!password) {
      setPasswordError("Password is required");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (!pendingKeypair) {
      setPasswordError("No keypair found");
      return;
    }

    try {
      setLoading(true);

      const { encrypted, salt, iv } = await encryptData(
        pendingKeypair.privateKey,
        password
      );

      await chrome.storage.local.set({
        nillion_encrypted_key: encrypted,
        nillion_salt: salt,
        nillion_iv: iv,
        nillion_did: pendingKeypair.did,
        nillion_unlocked: true,
      });

      if (chrome.storage.session) {
        await chrome.storage.session.set({
          nillion_session_key: pendingKeypair.privateKey,
        });
      }

      setPassword("");
      setConfirmPassword("");
      setPendingKeypair(null);

      setWallet({ has: true, did: pendingKeypair.did, key: "" });
      setScreen("main");
    } catch (e) {
      console.error("Error setting up password:", e);
      setPasswordError("Failed to encrypt wallet");
    } finally {
      setLoading(false);
    }
  };

  const unlockWallet = async () => {
    setUnlockError("");

    if (!password) {
      setUnlockError("Password is required");
      return;
    }

    try {
      setLoading(true);

      const r = await chrome.storage.local.get([
        "nillion_encrypted_key",
        "nillion_salt",
        "nillion_iv",
        "nillion_did",
      ]);

      if (!r.nillion_encrypted_key || !r.nillion_salt || !r.nillion_iv) {
        setUnlockError("Wallet data not found");
        return;
      }

      const isValid = await validatePassword(
        password,
        r.nillion_encrypted_key,
        r.nillion_salt,
        r.nillion_iv
      );

      if (!isValid) {
        setUnlockError("Invalid password");
        return;
      }

      const decryptedKey = await decryptData(
        r.nillion_encrypted_key,
        password,
        r.nillion_salt,
        r.nillion_iv
      );

      if (chrome.storage.session) {
        await chrome.storage.session.set({
          nillion_session_key: decryptedKey,
        });
      }

      await chrome.storage.local.set({ nillion_unlocked: true });

      setPassword("");
      setWallet({ has: true, did: r.nillion_did || "", key: "" });
      setScreen("main");
    } catch (e: any) {
      console.error("Error unlocking wallet:", e);
      setUnlockError(e.message || "Failed to unlock wallet");
    } finally {
      setLoading(false);
    }
  };

  const lockWallet = async () => {
    try {
      if (chrome.storage.session) {
        await chrome.storage.session.remove("nillion_session_key");
      }

      await chrome.storage.local.set({ nillion_unlocked: false });

      setWallet({ has: false, did: "", key: "" });
      setDocs([]);
      setSelected(null);
      setScreen("lock");
    } catch (e) {
      console.error("Error locking wallet:", e);
    }
  };

  const exportKey = async () => {
    const sessionKey = await chrome.storage.session?.get("nillion_session_key");
    if (sessionKey?.nillion_session_key) {
      setWallet({ ...wallet, key: sessionKey.nillion_session_key });
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    const b = document.activeElement as HTMLButtonElement;
    if (b) {
      const orig = b.innerHTML;
      b.innerHTML = "✓";
      setTimeout(() => (b.innerHTML = orig), 1000);
    }
  };

  const disconnect = async (site: string) => {
    if (!confirm(`Disconnect from ${site}?`)) return;
    try {
      const r = await chrome.runtime.sendMessage({
        type: "REMOVE_CONNECTED_SITE",
        origin: site,
      });
      if (r.success) setSites(sites.filter((s) => s !== site));
    } catch (e) {}
  };

  const isOwner = (
    grantee: string,
    owner: string,
    idx: number,
    list: ACL[]
  ) => {
    if (grantee === owner) return false;
    return idx === list.findIndex((a) => a.grantee !== owner);
  };

  const dedup = (list: ACL[]): ACL[] => {
    const m = new Map<string, ACL>();
    list.forEach((a) => {
      const ex = m.get(a.grantee);
      if (!ex) {
        m.set(a.grantee, a);
      } else {
        const ep =
          (ex.read ? 1 : 0) + (ex.write ? 1 : 0) + (ex.execute ? 1 : 0);
        const np = (a.read ? 1 : 0) + (a.write ? 1 : 0) + (a.execute ? 1 : 0);
        if (np > ep) m.set(a.grantee, a);
      }
    });
    return Array.from(m.values());
  };

  const modifyAcl = async () => {
    if (!editAcl || !selected) return;
    setBusy(true);
    try {
      const sessionKey = await chrome.storage.session?.get(
        "nillion_session_key"
      );
      if (!sessionKey?.nillion_session_key) {
        setScreen("lock");
        return;
      }

      const kp = Keypair.from(sessionKey.nillion_session_key);
      const user = await SecretVaultUserClient.from({
        baseUrls: NODES,
        keypair: kp,
        blindfold: { operation: "store" },
      });
      await user.revokeAccess({
        collection: selected.collection,
        document: selected.document,
        grantee: editAcl.grantee,
      });
      await user.grantAccess({
        collection: selected.collection,
        document: selected.document,
        acl: { grantee: editAcl.grantee, ...perms },
      });
      setModal(null);
      await loadDoc(selected);
    } catch (e: any) {
      console.error("Error modifying ACL:", e);
    } finally {
      setBusy(false);
    }
  };

  const addAcl = async () => {
    if (!newDid || !selected) return;
    setBusy(true);
    try {
      const sessionKey = await chrome.storage.session?.get(
        "nillion_session_key"
      );
      if (!sessionKey?.nillion_session_key) {
        setScreen("lock");
        return;
      }

      const kp = Keypair.from(sessionKey.nillion_session_key);
      const user = await SecretVaultUserClient.from({
        baseUrls: NODES,
        keypair: kp,
        blindfold: { operation: "store" },
      });
      await user.grantAccess({
        collection: selected.collection,
        document: selected.document,
        acl: { grantee: newDid.trim(), ...perms },
      });
      setModal(null);
      setNewDid("");
      await loadDoc(selected);
    } catch (e: any) {
      console.error("Error adding ACL:", e);
    } finally {
      setBusy(false);
    }
  };

  const revokeAcl = async (grantee: string) => {
    if (!selected || !confirm(`Revoke ${grantee.substring(0, 30)}...?`)) return;
    setBusy(true);
    try {
      const sessionKey = await chrome.storage.session?.get(
        "nillion_session_key"
      );
      if (!sessionKey?.nillion_session_key) {
        setScreen("lock");
        return;
      }

      const kp = Keypair.from(sessionKey.nillion_session_key);
      const user = await SecretVaultUserClient.from({
        baseUrls: NODES,
        keypair: kp,
        blindfold: { operation: "store" },
      });
      await user.revokeAccess({
        collection: selected.collection,
        document: selected.document,
        grantee,
      });
      await loadDoc(selected);
    } catch (e: any) {
      console.error("Error revoking ACL:", e);
    } finally {
      setBusy(false);
    }
  };

  const deleteDoc = async () => {
    if (!selected || !confirm("Delete permanently?")) return;
    setBusy(true);
    try {
      const sessionKey = await chrome.storage.session?.get(
        "nillion_session_key"
      );
      if (!sessionKey?.nillion_session_key) {
        setScreen("lock");
        return;
      }

      const kp = Keypair.from(sessionKey.nillion_session_key);
      const user = await SecretVaultUserClient.from({
        baseUrls: NODES,
        keypair: kp,
        blindfold: { operation: "store" },
      });
      await user.deleteData({
        collection: selected.collection,
        document: selected.document,
      });
      setSelected(null);
      await loadDocs();
    } catch (e: any) {
      console.error("Error deleting document:", e);
    } finally {
      setBusy(false);
    }
  };

  const checkRequest = async () => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("request");
    const a = p.get("action");
    if (id && a) {
      try {
        const r = await chrome.runtime.sendMessage({
          type: "GET_PENDING_REQUEST",
          requestId: id,
        });
        if (r.success) {
          setRequest({
            id,
            action: a,
            origin: r.request.origin,
            data: r.request.data,
          });
          setTab("approve");
        }
      } catch (e) {
        setRequest({ id, action: a });
        setTab("approve");
      }
    }
  };

  const renderVal = (k: string, v: any) => {
    if (k === "_acl") return null;

    if (typeof v === "string") {
      return (
        <div className="value-display">
          <span className="value-text">{v}</span>
          <button
            className="copy-btn-inline"
            onClick={(e) => {
              e.stopPropagation();
              copy(v);
            }}
          >
            Copy
          </button>
        </div>
      );
    }
    if (typeof v === "number") {
      return <div className="value-field">{v}</div>;
    }
    if (typeof v === "boolean") {
      return <div className="value-field">{v.toString()}</div>;
    }
    if (Array.isArray(v)) {
      return <div className="value-code">{JSON.stringify(v, null, 2)}</div>;
    }
    if (typeof v === "object") {
      return <div className="value-code">{JSON.stringify(v, null, 2)}</div>;
    }
    return <div className="value-field">{String(v)}</div>;
  };

  const handleStore = async (kp: any, details: any) => {
    const p = details.data;
    if (!p.collection || !p.data || !p.delegation || !p.builderDid)
      throw new Error("Missing fields");
    const user = await SecretVaultUserClient.from({
      baseUrls: p.nodeUrls || NODES,
      keypair: kp,
      blindfold: { operation: "store" },
    });
    const uid = kp.toDid().toString();
    const storeParams = {
      owner: uid,
      acl: {
        grantee: p.builderDid,
        read: true,
        write: false,
        execute: true,
      },
      collection: p.collection,
      data: [p.data],
    };
    const res = await user.createData(p.delegation, storeParams);
    return {
      success: true,
      collection: p.collection,
      document: p.data._id,
      result: res,
    };
  };

  const handleRetrieve = async (kp: any, details: any) => {
    const p = details.data;
    if (!p.collection || !p.document) throw new Error("Missing fields");
    const user = await SecretVaultUserClient.from({
      baseUrls: p.nodeUrls || NODES,
      keypair: kp,
      blindfold: { operation: "store" },
    });
    const res = await user.readData({
      collection: p.collection,
      document: p.document,
    });
    return { success: true, data: res.data };
  };

  const handleGrant = async (kp: any, details: any) => {
    const p = details.data;
    if (!p.collection || !p.document || !p.grantee)
      throw new Error("Missing fields");
    const user = await SecretVaultUserClient.from({
      baseUrls: p.nodeUrls || NODES,
      keypair: kp,
      blindfold: { operation: "store" },
    });
    await user.grantAccess({
      collection: p.collection,
      document: p.document,
      acl: {
        grantee: p.grantee,
        read: p.permissions?.read || false,
        write: p.permissions?.write || false,
        execute: p.permissions?.execute || false,
      },
    });
    return { success: true, message: "Access granted" };
  };

  const handleRevoke = async (kp: any, details: any) => {
    const p = details.data;
    if (!p.collection || !p.document || !p.grantee)
      throw new Error("Missing fields");
    const user = await SecretVaultUserClient.from({
      baseUrls: p.nodeUrls || NODES,
      keypair: kp,
      blindfold: { operation: "store" },
    });
    await user.revokeAccess({
      collection: p.collection,
      document: p.document,
      grantee: p.grantee,
    });
    return { success: true, message: "Access revoked" };
  };

  const handleList = async (kp: any) => {
    const user = await SecretVaultUserClient.from({
      baseUrls: NODES,
      keypair: kp,
      blindfold: { operation: "store" },
    });
    const res = await user.listDataReferences();
    return { success: true, data: res.data || [] };
  };

  const approve = async () => {
    if (!request) return;
    try {
      setLoading(true);
      const sessionKey = await chrome.storage.session?.get(
        "nillion_session_key"
      );
      if (!sessionKey?.nillion_session_key) {
        setScreen("lock");
        return;
      }

      const kp = Keypair.from(sessionKey.nillion_session_key);
      let result: any = { success: true };

      if (request.action === "storeData")
        result = await handleStore(kp, request);
      else if (request.action === "retrieveData")
        result = await handleRetrieve(kp, request);
      else if (request.action === "grantAccess")
        result = await handleGrant(kp, request);
      else if (request.action === "revokeAccess")
        result = await handleRevoke(kp, request);
      else if (request.action === "listData") result = await handleList(kp);

      await chrome.runtime.sendMessage({
        type: "APPROVAL_RESPONSE",
        requestId: request.id,
        approved: true,
        result,
      });
      window.close();
    } catch (e: any) {
      await chrome.runtime.sendMessage({
        type: "APPROVAL_RESPONSE",
        requestId: request.id,
        approved: true,
        result: { success: false, error: e.message },
      });
      window.close();
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    if (!request) return;
    await chrome.runtime.sendMessage({
      type: "APPROVAL_RESPONSE",
      requestId: request.id,
      approved: false,
    });
    window.close();
  };

  if (screen === "loading") {
    return (
      <div className="container">
        <div className="loading-page">Loading</div>
      </div>
    );
  }

  if (screen === "onboard") {
    return (
      <div className="container onboard">
        <div className="onboard-content">
          <div className="main-header">
            <h2>
              Nillion <span className="header-accent">Keychain</span>
            </h2>
          </div>
          <div className="onboard-actions">
            <button className="btn-create" onClick={createWallet}>
              Create New Key
            </button>
            <button className="btn-import" onClick={importWallet}>
              Import Key
            </button>
          </div>
          <div className="onboard-notice">
            Keep your private key secure. Never share it with anyone.
          </div>
        </div>
      </div>
    );
  }

  if (screen === "setup-password") {
    return (
      <div className="container onboard">
        <div className="onboard-content">
          <div className="main-header">
            <h2>
              Setup <span className="header-accent">Password</span>
            </h2>
          </div>
          <div className="password-setup-form">
            <p className="password-instruction">
              Create a password to encrypt your wallet. You'll need this
              password to unlock your wallet.
            </p>
            <div className="form-field">
              <label>Password (min. 8 characters)</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
            <div className="form-field">
              <label>Confirm Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") setupPassword();
                }}
              />
            </div>
            {passwordError && (
              <div className="error-message">{passwordError}</div>
            )}
            <button
              className="btn-create"
              onClick={setupPassword}
              disabled={loading}
            >
              {loading ? "Encrypting..." : "Create Wallet"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "lock") {
    return (
      <div className="container onboard">
        <div className="onboard-content">
          <div className="main-header">
            <h2>
              Unlock <span className="header-accent">Wallet</span>
            </h2>
          </div>
          <div className="password-setup-form">
            <div className="lock-icon">🔒</div>
            <p className="password-instruction">
              Enter your password to unlock your wallet
            </p>
            <div className="form-field">
              <label>Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") unlockWallet();
                }}
              />
            </div>
            {unlockError && <div className="error-message">{unlockError}</div>}
            <button
              className="btn-create"
              onClick={unlockWallet}
              disabled={loading}
            >
              {loading ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="main-header">
        <h2>
          Nillion <span className="header-accent">Keychain</span>
        </h2>
      </div>

      <main className="main-content">
        {tab === "wallet" && (
          <div className="view">
            <div className="view-header">
              <h2>Key Details</h2>
              <button className="btn-lock" onClick={lockWallet}>
                🔒 Lock
              </button>
            </div>

            {sub && (
              <div className={`status-card ${sub.has ? "active" : "inactive"}`}>
                <div className="status-content">
                  <div className="status-label">
                    {sub.has ? "Subscription Active" : "No Subscription"}
                  </div>
                  <div className="status-message">{sub.msg}</div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-section">
                <div className="section-label">Decentralized Identifier</div>
                <div className="code-display">
                  <code>{wallet.did.substring(0, 40)}...</code>
                  <button className="btn-copy" onClick={() => copy(wallet.did)}>
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-section">
                <div className="section-label">Connected Applications</div>
                {sites.length > 0 ? (
                  <div className="app-list">
                    {sites.map((s) => (
                      <div key={s} className="app-item">
                        <span className="app-url">{s}</span>
                        <button
                          className="btn-remove"
                          onClick={() => disconnect(s)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-mini">
                    No connected applications
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-section">
                <div className="section-label">Key Management</div>
                <button className="btn-action" onClick={exportKey}>
                  Export Private Key
                </button>
                {wallet.key && (
                  <div className="key-export">
                    <textarea
                      readOnly
                      value={wallet.key}
                      className="key-textarea"
                      rows={3}
                    />
                    <button
                      className="btn-action btn-secondary"
                      onClick={() => copy(wallet.key)}
                    >
                      Copy Key
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "documents" && (
          <div className="view">
            <div className="view-header">
              <h2>Documents</h2>
              <button
                className="btn-refresh-docs"
                onClick={loadDocs}
                disabled={busy}
              >
                Refresh
              </button>
            </div>

            {busy && <div className="loading-state">Loading...</div>}

            {!busy && docs.length === 0 && !selected && (
              <div className="empty-state">
                <div className="empty-text">No documents</div>
              </div>
            )}

            {!busy && docs.length > 0 && !selected && (
              <div className="documents-grid">
                {docs.map((d, i) => (
                  <div
                    key={`${d.collection}-${d.document}`}
                    className="doc-card"
                    onClick={() => loadDoc(d)}
                  >
                    <div className="doc-number">{i + 1}</div>
                    <div className="doc-info">
                      <div className="doc-id">
                        {d.document.substring(0, 24)}...
                      </div>
                      <div className="doc-collection">
                        {d.collection.substring(0, 20)}...
                      </div>
                    </div>
                    <div className="doc-arrow">→</div>
                  </div>
                ))}
              </div>
            )}

            {selected && (
              <div className="document-view">
                <div className="doc-view-header">
                  <button
                    className="btn-back"
                    onClick={() => setSelected(null)}
                  >
                    ← Back to Documents
                  </button>
                  <div className="view-toggle-group">
                    <button
                      className={`toggle ${view === "pretty" ? "active" : ""}`}
                      onClick={() => setView("pretty")}
                    >
                      Display
                    </button>
                    <button
                      className={`toggle ${view === "raw" ? "active" : ""}`}
                      onClick={() => setView("raw")}
                    >
                      Raw
                    </button>
                  </div>
                </div>

                <div className="doc-meta">
                  <div className="meta-row">
                    <span className="meta-key">Document ID</span>
                    <span className="meta-val">{selected.document}</span>
                    <button
                      className="btn-copy-small"
                      onClick={() => copy(selected.document)}
                    >
                      Copy
                    </button>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Collection</span>
                    <span className="meta-val">{selected.collection}</span>
                    <button
                      className="btn-copy-small"
                      onClick={() => copy(selected.collection)}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-section">
                    <div className="section-label">Content</div>
                    {selected.data === "Loading..." ? (
                      <div className="loading-state">Loading...</div>
                    ) : view === "pretty" ? (
                      <div className="data-display">
                        {typeof selected.data === "object" &&
                        selected.data !== null ? (
                          Object.entries(selected.data).map(([k, v]) =>
                            k === "_acl" || k === "_ACL" ? (
                              <></>
                            ) : (
                              <div key={k} className="data-row">
                                <span className="data-key">{k}</span>
                                <span className="data-value">
                                  {renderVal(k, v)}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="data-value">
                            {String(selected.data)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <pre className="data-raw">
                        {JSON.stringify(selected.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                {selected.data?._acl && (
                  <div className="card">
                    <div className="card-section">
                      <div className="section-header">
                        <div className="section-label">Access Control</div>
                        <button
                          className="btn-add"
                          onClick={() => setModal("add")}
                          disabled={busy}
                        >
                          +
                        </button>
                      </div>
                      <div className="acl-list">
                        {dedup(selected.data._acl).map((a, i) => {
                          const own = isOwner(
                            a.grantee,
                            selected.data._owner,
                            i,
                            dedup(selected.data._acl)
                          );
                          return (
                            <div
                              key={i}
                              className={`acl-card ${own ? "owner" : ""}`}
                            >
                              <div className="acl-header">
                                <span className="acl-role">
                                  {own ? "Owner" : "Accessor"}
                                </span>
                                {own && (
                                  <span className="acl-required">Required</span>
                                )}
                              </div>
                              <div className="acl-did">
                                <code>{a.grantee}</code>
                                <button
                                  className="btn-copy-tiny"
                                  onClick={() => copy(a.grantee)}
                                >
                                  Copy
                                </button>
                              </div>
                              <div className="acl-perms">
                                {a.read && <span className="perm">Read</span>}
                                {a.write && <span className="perm">Write</span>}
                                {a.execute && (
                                  <span className="perm">Execute</span>
                                )}
                              </div>
                              {!own && (
                                <div className="acl-actions">
                                  <button
                                    className="btn-edit"
                                    onClick={() => {
                                      setEditAcl(a);
                                      setPerms({
                                        read: a.read,
                                        write: a.write,
                                        execute: a.execute,
                                      });
                                      setModal("acl");
                                    }}
                                    disabled={busy}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn-revoke"
                                    onClick={() => revokeAcl(a.grantee)}
                                    disabled={busy}
                                  >
                                    Revoke
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="card danger">
                  <button
                    className="btn-delete"
                    onClick={deleteDoc}
                    disabled={busy}
                  >
                    Delete Document
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "approve" && (
          <div className="view">
            <div className="view-header">
              <h2>Approval Request</h2>
            </div>

            {loading && <div className="loading-state">Processing...</div>}

            {!loading && request ? (
              <div className="card">
                <div className="card-section">
                  <div className="approval-details">
                    <div className="approval-row">
                      <span className="label">Application</span>
                      <span className="value">{request.origin}</span>
                    </div>
                    <div className="approval-row">
                      <span className="label">Action</span>
                      <span className="value">{request.action}</span>
                    </div>
                  </div>
                  <div className="approval-notice">
                    Only approve actions from applications you trust.
                  </div>
                  <div className="approval-actions">
                    <button className="btn-approve" onClick={approve}>
                      Approve
                    </button>
                    <button className="btn-deny" onClick={reject}>
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              !loading && (
                <div className="empty-state">
                  <div className="empty-text">No pending approvals</div>
                </div>
              )
            )}
          </div>
        )}
      </main>

      {modal === "acl" && editAcl && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Access</h3>
              <button className="btn-close" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Identifier</label>
                <div className="code-block">{editAcl.grantee}</div>
              </div>
              <div className="form-field">
                <label>Permissions</label>
                <div className="perms-checkboxes">
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={perms.read}
                      onChange={(e) =>
                        setPerms({ ...perms, read: e.target.checked })
                      }
                    />
                    <span>Read</span>
                  </label>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={perms.write}
                      onChange={(e) =>
                        setPerms({ ...perms, write: e.target.checked })
                      }
                    />
                    <span>Write</span>
                  </label>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={perms.execute}
                      onChange={(e) =>
                        setPerms({ ...perms, execute: e.target.checked })
                      }
                    />
                    <span>Execute</span>
                  </label>
                </div>
              </div>
              <button
                className="btn-primary"
                onClick={modifyAcl}
                disabled={busy}
              >
                {busy ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "add" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Grant Access</h3>
              <button className="btn-close" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Identifier (DID)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="did:nil:03..."
                  value={newDid}
                  onChange={(e) => setNewDid(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Permissions</label>
                <div className="perms-checkboxes">
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={perms.read}
                      onChange={(e) =>
                        setPerms({ ...perms, read: e.target.checked })
                      }
                    />
                    <span>Read</span>
                  </label>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={perms.write}
                      onChange={(e) =>
                        setPerms({ ...perms, write: e.target.checked })
                      }
                    />
                    <span>Write</span>
                  </label>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={perms.execute}
                      onChange={(e) =>
                        setPerms({ ...perms, execute: e.target.checked })
                      }
                    />
                    <span>Execute</span>
                  </label>
                </div>
              </div>
              <button
                className="btn-primary"
                onClick={addAcl}
                disabled={!newDid || busy}
              >
                {busy ? "Granting..." : "Grant Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <button
          className={`nav-item ${tab === "wallet" ? "active" : ""}`}
          onClick={() => setTab("wallet")}
          title="Key Details"
        >
          ≣
        </button>
        <button
          className={`nav-item ${tab === "documents" ? "active" : ""}`}
          onClick={() => setTab("documents")}
          title="Documents"
        >
          ▬{docs.length > 0 && <span className="nav-badge">{docs.length}</span>}
        </button>
        <button
          className={`nav-item ${tab === "approve" ? "active" : ""}`}
          onClick={() => setTab("approve")}
          title="Approvals"
        >
          ✓
        </button>
      </nav>
    </div>
  );
}

export default App;
