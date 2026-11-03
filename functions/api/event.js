// Anonymous event counter. Stores only (day, event, referrer host) -> count.
// No IPs, cookies, user agents or file info are read or stored.
const EVENTS = new Set(["pageview", "convert_start", "convert_done", "convert_fail", "download"]);

export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
}

export async function onRequestPost({ request, env }) {
  try {
    const { e, r } = await request.json();
    if (!EVENTS.has(e)) return new Response(null, { status: 400 });
    let ref = "";
    if (e === "pageview" && typeof r === "string") {
      ref = r.toLowerCase().replace(/^www\.|^old\.|^new\.|^m\./, "").slice(0, 100);
      if (!/^[a-z0-9.-]*$/.test(ref)) ref = "other";
    }
    await env.DB.prepare(
      "INSERT INTO counts (day, event, ref, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT(day, event, ref) DO UPDATE SET n = n + 1",
    ).bind(today(), e, ref).run();
  } catch {
    return new Response(null, { status: 400 });
  }
  return new Response(null, { status: 204 });
}
