import http from "node:http";

const PORT = Number(process.env.PORT ?? 3000);
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 3001);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 3002);

// Le frontend et le backend tournent dans le même conteneur derrière ce
// proxy : un seul port public, même origine pour le navigateur (cookies et
// CORS deviennent non-problématiques), routage par préfixe de chemin.
function targetPortFor(pathname) {
  return pathname.startsWith("/api/") || pathname.startsWith("/uploads/")
    ? BACKEND_PORT
    : FRONTEND_PORT;
}

const server = http.createServer((req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  const port = targetPortFor(pathname);

  const proxyReq = http.request(
    { hostname: "127.0.0.1", port, path: req.url, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    console.error("[proxy] erreur en amont:", err);
    if (!res.headersSent) res.writeHead(502);
    res.end("Bad gateway");
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Justif démarré sur http://localhost:${PORT}`);
});
