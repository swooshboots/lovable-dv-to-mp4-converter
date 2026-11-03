// Anonymous usage counter. Sends only an event name (and, for page views, the
// referring site's hostname). No file names, contents, cookies or IDs.
export type TrackEvent = "pageview" | "convert_start" | "convert_done" | "convert_fail" | "download";

export function track(e: TrackEvent) {
  try {
    if (typeof window === "undefined" || location.hostname === "localhost") return;
    let r = "";
    if (e === "pageview" && document.referrer) {
      try {
        const h = new URL(document.referrer).hostname;
        if (h !== location.hostname) r = h;
      } catch {
        // ignore
      }
    }
    const body = JSON.stringify({ e, r });
    if (!navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/event", { method: "POST", body, keepalive: true, credentials: "omit" }).catch(() => {});
    }
  } catch {
    // never break the app
  }
}
