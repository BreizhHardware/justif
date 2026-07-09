import http from "node:http";

const PORT = Number(process.env.PORT ?? 3000);
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 3001);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 3002);

// The frontend and backend run in the same container behind this proxy:
// one public port, same origin for the browser (cookies and CORS are
// non-issues), routing by path prefix.
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
    console.error("[proxy] upstream error:", err);
    if (!res.headersSent) res.writeHead(502);
    res.end("Bad gateway");
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Justif started on http://localhost:${PORT}`);
});
