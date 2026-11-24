import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

// BACKEND_HOST=127.0.0.1 in the unified Docker image: the backend is only reachable through
// the internal proxy, so X-Forwarded-For (audit IP, rate limit) can't be forged by going direct.
const HOST = process.env.BACKEND_HOST || "0.0.0.0";

createApp().listen(PORT, HOST, () => {
  console.log(`Justif backend started on http://${HOST}:${PORT}`);
});
