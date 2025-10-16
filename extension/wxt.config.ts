import { defineConfig } from "wxt";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import nodePolyfills from "rollup-plugin-node-polyfills";

export default defineConfig({
  manifest: {
    name: "Nillion Keychain",
    description: "Secure wallet for Nillion Network",
    version: "1.0.0",
    permissions: ["storage", "activeTab"],
    host_permissions: ["<all_urls>"],
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["content-scripts/content.js"],
        run_at: "document_start",
        world: "MAIN",
      },
      {
        matches: ["<all_urls>"],
        js: ["bridge.js"],
        run_at: "document_start",
        world: "ISOLATED",
      },
    ],
  },
  vite: () => ({
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      global: "globalThis",
    },
    resolve: {
      alias: {
        buffer: "buffer",
        process: "process/browser",
        stream: "stream-browserify",
        util: "util",
        events: "events",
      },
    },
    optimizeDeps: {
      include: [
        "buffer",
        "process/browser",
        "events",
        "stream-browserify",
        "util",
      ],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
        plugins: [
          NodeGlobalsPolyfillPlugin({
            process: true,
            buffer: true,
          }),
          NodeModulesPolyfillPlugin(),
        ],
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        plugins: [nodePolyfills()],
      },
    },
  }),
});
