# DV to MP4 Converter

Exported from Lovable on 2026-10-26.

- Lovable project: https://lovable.dev/projects/12719dcc-b7f3-4fc7-b1d9-8b7d92d9a0e0
- Lovable project ID: `12719dcc-b7f3-4fc7-b1d9-8b7d92d9a0e0`
- Exported commit: `05bd5ba819b644adcf0f3912cf62755644458797`

Converts DV footage to MP4 entirely in the browser with ffmpeg.wasm. There is no backend:
the production build is a plain static site.

## Run locally
```
bun install        # or: npm install
bun run dev        # or: npm run dev
```

## Build
```
bun run build      # or: npm run build
```
Static output: **`dist/client`** (deploy this folder). `dist/server` is only used at build
time to prerender `/` and is not deployed.

## Deploy to Cloudflare Pages

Connect the GitHub repo in Workers & Pages → Create → Pages → Connect to Git, then use:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist/client` |
| Root directory | `/` (repo root) |
| Node version | 22 (pinned via `.nvmrc`; or set env var `NODE_VERSION=22`) |
| Environment variables | none required |

Notes:
- `wrangler.toml` sets `pages_build_output_dir = "./dist/client"` for `wrangler pages deploy`.
- `public/_headers` sets long-lived caching for hashed `/assets/*` and `no-store` for
  `/download-worker.js` (a cleanup service worker that unregisters old caches).
- SPA routing: no `_redirects` needed. Pages serves `index.html` for unknown paths
  automatically because the build has no `404.html`.
- **No COOP/COEP headers are needed.** The app uses the single-threaded ffmpeg core
  (`@ffmpeg/core`, no `SharedArrayBuffer`). The core is fetched at runtime from unpkg, with
  jsDelivr as a fallback (`src/hooks/useFfmpeg.ts`), because `ffmpeg-core.wasm` (~31 MB) is
  over Cloudflare Pages' 25 MiB per-file limit and can't be self-hosted in the static build.
- Custom domain: Pages project → Custom domains → Set up a custom domain.
