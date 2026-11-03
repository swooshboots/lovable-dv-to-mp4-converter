import { today } from "./api/event.js";

const LABELS = {
  pageview: "page views",
  convert_start: "conversions started",
  convert_done: "conversions completed",
  convert_fail: "conversions failed",
  download: "downloads",
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export async function onRequestGet({ request, env }) {

  const t = today();
  const d = new Date(t + "T12:00:00Z");
  const days = [];
  for (let i = 0; i < 7; i++) days.push(new Date(d - i * 864e5).toISOString().slice(0, 10));
  const since = days[6];

  const db = env.DB;
  const [tot, daily, refs] = await Promise.all([
    db.prepare("SELECT event, SUM(n) n FROM counts GROUP BY event").all(),
    db.prepare("SELECT day, event, SUM(n) n FROM counts WHERE day >= ?1 GROUP BY day, event").bind(since).all(),
    db.prepare("SELECT ref, SUM(n) n FROM counts WHERE event='pageview' GROUP BY ref ORDER BY n DESC LIMIT 15").all(),
  ]);
  const totals = Object.fromEntries(tot.results.map((r) => [r.event, r.n]));
  const byDay = {};
  for (const r of daily.results) (byDay[r.day] ??= {})[r.event] = r.n;
  const sum7 = (e) => days.reduce((a, x) => a + (byDay[x]?.[e] || 0), 0);
  const ev = Object.keys(LABELS);

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>stats</title>
<style>body{background:#0a0a0a;color:#33ff66;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;margin:0;padding:24px}
.f{border:1px solid #33ff66;padding:16px;margin:0 auto 20px;max-width:860px}h1,h2{font-size:14px;margin:0 0 12px;text-transform:uppercase}
table{border-collapse:collapse;width:100%}td,th{padding:4px 8px;text-align:right;border-bottom:1px dashed #1f7a3a}td:first-child,th:first-child{text-align:left}
.dim{color:#1f9a45}</style></head><body>
<div class="f"><h1>[ dv-to-mp4 :: stats ]</h1><div class="dim">days are America/Denver · anonymous counts only · updated ${esc(new Date().toISOString())}</div></div>
<div class="f"><h2>[ summary ]</h2><table><tr><th>event</th><th>today</th><th>last 7 days</th><th>all time</th></tr>
${ev.map((e) => `<tr><td>${LABELS[e]}</td><td>${byDay[t]?.[e] || 0}</td><td>${sum7(e)}</td><td>${totals[e] || 0}</td></tr>`).join("")}</table></div>
<div class="f"><h2>[ daily · last 7 days ]</h2><table><tr><th>day</th>${ev.map((e) => `<th>${LABELS[e]}</th>`).join("")}</tr>
${days.map((x) => `<tr><td>${x}</td>${ev.map((e) => `<td>${byDay[x]?.[e] || 0}</td>`).join("")}</tr>`).join("")}</table></div>
<div class="f"><h2>[ top referrers · page views ]</h2><table><tr><th>source</th><th>views</th></tr>
${refs.results.map((r) => `<tr><td>${esc(r.ref || "(direct / none)")}</td><td>${r.n}</td></tr>`).join("") || "<tr><td>none yet</td><td>0</td></tr>"}</table></div>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
