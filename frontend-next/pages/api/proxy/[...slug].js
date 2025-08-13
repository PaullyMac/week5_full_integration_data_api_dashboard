export default async function handler(req, res) {
  const base = process.env.PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const slug = Array.isArray(req.query.slug) ? req.query.slug.join("/") : "";
  const qs   = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
  const url  = `${base}/${slug}${qs}`;

  try {
    const resp = await fetch(url, { method: req.method, headers: { accept: "application/json" } });
    const body = await resp.text();
    res.status(resp.status);
    res.setHeader("Content-Type", resp.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "no-cache");
    res.send(body);
  } catch (e) {
    res.status(502).json({ error: "Proxy failed", detail: String(e) });
  }
}
