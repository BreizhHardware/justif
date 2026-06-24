"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      try {
        const status = await apiFetch<{ setupComplete: boolean }>("/api/auth/status");
        if (!status.setupComplete) {
          router.replace("/setup");
          return;
        }
        await apiFetch("/api/auth/me");
        router.replace("/expenses");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/login");
      }
    }
    redirect();
  }, [router]);

  return null;
}
