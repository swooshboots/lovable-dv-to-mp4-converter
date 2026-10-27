import { createFileRoute } from "@tanstack/react-router";

const cleanupWorker = `
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});
`;

export const Route = createFileRoute("/download-worker.js")({
  server: {
    handlers: {
      GET: async () =>
        new Response(cleanupWorker, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store, max-age=0",
            "service-worker-allowed": "/",
          },
        }),
    },
  },
});
