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
  private cookie: string | undefined;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (typeof init.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) headers.set("Cookie", this.cookie);

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
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
