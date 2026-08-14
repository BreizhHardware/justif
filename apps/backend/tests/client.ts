import type { Server } from "node:http";
import { createApp } from "../src/app.js";

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// Petit client fetch avec pot à cookies, pour suivre la session JWT (cookie
// httpOnly) entre les requêtes d'un même test sans dépendance externe.
export class TestClient {
  private cookies = new Map<string, string>();
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (typeof init.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookies.size > 0) {
      headers.set("Cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    // A response may set several cookies at once (e.g. clearing the OIDC flow
    // cookie while setting the session cookie) - undici joins multiple
    // Set-Cookie headers into one comma-separated string on .get(), so use
    // getSetCookie() to read each one individually.
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    return res;
  }

  get(path: string) {
    return this.request(path);
  }

  post(path: string, body?: unknown) {
    return this.request(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  postForm(path: string, formData: FormData) {
    return this.request(path, { method: "POST", body: formData });
  }

  patch(path: string, body?: unknown) {
    return this.request(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete(path: string) {
    return this.request(path, { method: "DELETE" });
  }
}
