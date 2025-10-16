export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  world: "ISOLATED",

  main() {
    document.addEventListener("NILLION_REQUEST", async (e: any) => {
      const { id, type, payload } = e.detail;
      try {
        const r = await browser.runtime.sendMessage({ type, payload });
        document.dispatchEvent(
          new CustomEvent("NILLION_RESPONSE", { detail: { id, response: r } })
        );
      } catch (err: any) {
        document.dispatchEvent(
          new CustomEvent("NILLION_RESPONSE", {
            detail: {
              id,
              response: { success: false, error: err?.message || "Error" },
            },
          })
        );
      }
    });

    browser.runtime.onMessage.addListener((m) => {
      if (m.type === "NILLION_DISCONNECTED") {
        document.dispatchEvent(
          new CustomEvent("NILLION_FORCE_DISCONNECT", {
            detail: { origin: m.origin },
          })
        );
      }
    });
  },
});
