import { defineConfig, mergeConfig } from "vite";
import path from "path";
import baseConfig from "../vite.config";

// Dev server for the Playwright suite: the real app, with Clerk swapped for a
// signed-in stub. API calls go to E2E_API_ORIGIN and are fulfilled by
// page.route() fixtures in e2e/support/mock-api.ts.
export default defineConfig((env) =>
  mergeConfig(typeof baseConfig === "function" ? baseConfig(env) : baseConfig, {
    resolve: {
      alias: [
        { find: /^@clerk\/clerk-react$/, replacement: path.resolve(__dirname, "support/clerk-stub.tsx") },
      ],
    },
  }),
);
