import { crx } from "@crxjs/vite-plugin";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
});
