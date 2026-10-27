// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
//
// Static deploy (Cloudflare Pages): the app has no backend — ffmpeg.wasm runs in the browser —
// so we skip Nitro (no Worker/SSR bundle) and prerender "/" to static HTML. The deployable
// static site is written to dist/client (see README → "Deploy to Cloudflare Pages").
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // Only used at build time to prerender pages; nothing server-side is deployed.
    server: { entry: "server" },
    prerender: {
      enabled: true,
      crawlLinks: true,
      failOnError: true,
    },
    pages: [{ path: "/" }],
  },
});
