const pending = new Map<string, any>();

const getSites = async () => {
  const r = await chrome.storage.local.get("connected_sites");
  return r.connected_sites || {};
};

const saveSite = async (origin: string) => {
  const s = await getSites();
  s[origin] = true;
  await chrome.storage.local.set({ connected_sites: s });
};

const isConnected = async (origin: string) =>
  (await getSites())[origin] === true;

const removeSite = async (origin: string) => {
  const s = await getSites();
  delete s[origin];
  await chrome.storage.local.set({ connected_sites: s });
};

const notifyTabs = async (origin: string) => {
  try {
    const tabs = await chrome.tabs.query({ url: `${origin}/*` });
    for (const t of tabs) {
      if (t.id)
        chrome.tabs
          .sendMessage(t.id, { type: "NILLION_DISCONNECTED", origin })
          .catch(() => {});
    }
  } catch (e) {}
};

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((msg, sender, res) => {
    if (sender.id !== chrome.runtime.id) return;
    handle(msg, sender)
      .then(res)
      .catch((e) => res({ success: false, error: e.message }));
    return true;
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "APPROVAL_RESPONSE") {
      const r = pending.get(msg.requestId);
      if (r) {
        r.approved = msg.approved;
        r.result = msg.result;
      }
    }
  });
});

async function handle(msg: any, sender: any) {
  const origin = sender.url ? new URL(sender.url).origin : "unknown";

  switch (msg.type) {
    case "NILLION_CONNECT":
      return await connect(origin);
    case "NILLION_GET_DID":
      return await getDid(origin);
    case "NILLION_CHECK_CONNECTION":
      const conn = await isConnected(origin);
      if (conn) {
        const r = await chrome.storage.local.get("nillion_did");
        return { success: true, connected: true, did: r.nillion_did };
      }
      return { success: true, connected: false };
    case "NILLION_DISCONNECT":
      await removeSite(origin);
      await notifyTabs(origin);
      return { success: true };
    case "REMOVE_CONNECTED_SITE":
      await removeSite(msg.origin);
      await notifyTabs(msg.origin);
      return { success: true };
    case "GET_CONNECTED_SITES":
      return { success: true, sites: Object.keys(await getSites()) };
    case "GET_PENDING_REQUEST":
      const p = pending.get(msg.requestId);
      return p
        ? { success: true, request: p }
        : { success: false, error: "Not found" };
    case "NILLION_STORE_DATA":
      return await requestApproval(origin, "storeData", msg.payload);
    case "NILLION_RETRIEVE_DATA":
      return await requestApproval(origin, "retrieveData", msg.payload);
    case "NILLION_GRANT_ACCESS":
      return await requestApproval(origin, "grantAccess", msg.payload);
    case "NILLION_REVOKE_ACCESS":
      return await requestApproval(origin, "revokeAccess", msg.payload);
    case "NILLION_LIST_DATA":
      return await requestApproval(origin, "listData", msg.payload);
    default:
      return { success: false, error: "Unknown type" };
  }
}

async function connect(origin: string) {
  try {
    const r = await chrome.storage.local.get([
      "nillion_private_key",
      "nillion_did",
    ]);
    if (!r.nillion_private_key)
      return { success: false, error: "Wallet not setup" };
    if (await isConnected(origin))
      return { success: true, did: r.nillion_did, alreadyConnected: true };
    await requestApproval(origin, "connect", { origin });
    await saveSite(origin);
    return { success: true, did: r.nillion_did };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function getDid(origin: string) {
  if (!(await isConnected(origin)))
    return { success: false, error: "Not connected" };
  const r = await chrome.storage.local.get("nillion_did");
  return { success: true, did: r.nillion_did };
}

async function requestApproval(origin: string, action: string, data: any) {
  const id = Math.random().toString(36).substring(7);
  pending.set(id, { origin, action, data, approved: undefined });

  await chrome.windows.create({
    url: chrome.runtime.getURL(`popup.html?request=${id}&action=${action}`),
    type: "popup",
    width: 450,
    height: 600,
  });

  return new Promise((res, rej) => {
    const to = setTimeout(() => {
      pending.delete(id);
      rej(new Error("Timeout"));
    }, 300000);

    const iv = setInterval(() => {
      const p = pending.get(id);
      if (p?.approved !== undefined) {
        clearInterval(iv);
        clearTimeout(to);
        pending.delete(id);
        p.approved
          ? res(p.result || { success: true })
          : rej(new Error("Rejected"));
      }
    }, 100);
  });
}
