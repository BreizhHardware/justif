"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiFetch, ApiError } from "@/lib/api";
import { Badge, Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";

interface User {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[] | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  async function load() {
    const [list, me] = await Promise.all([
      apiFetch<User[]>("/api/users"),
      apiFetch<{ email: string; role: string }>("/api/auth/me"),
    ]);
    setUsers(list);
    setCurrentUserId(list.find((u) => u.email === me.email)?.id ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ email, password, role }),
      });
      setEmail("");
      setPassword("");
      setRole("user");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("users.createError"));
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: User) {
    await apiFetch(`/api/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !user.active }),
    });
    load();
  }

  async function toggleRole(user: User) {
    await apiFetch(`/api/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: user.role === "admin" ? "user" : "admin" }),
    });
    load();
  }

  return (
    <AppShell>
      <PageHeader title={t("users.title")} />

      <Card className="mb-6 max-w-xl p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("users.newUserTitle")}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="newEmail">{t("users.email")}</Label>
            <Input
              id="newEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="newPassword">{t("users.password")}</Label>
            <Input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="newRole">{t("users.role")}</Label>
            <Select
              id="newRole"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              className="max-w-xs"
            >
              <option value="user">{t("users.user")}</option>
              <option value="admin">{t("users.admin")}</option>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={creating}>
            <UserPlus size={16} />
            {t("users.create")}
          </Button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("users.email")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("users.role")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("users.active")}
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    {user.email}
                    {isSelf && (
                      <span className="ml-2 text-xs text-slate-400">({t("users.you")})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={user.role === "admin" ? "brand" : "slate"}>
                      {user.role === "admin" ? t("users.admin") : t("users.user")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={user.active ? "brand" : "amber"}>
                      {user.active ? t("users.active") : t("users.inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => toggleRole(user)}
                        disabled={isSelf}
                        className="flex items-center gap-1 text-slate-500 transition hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                        title={user.role === "admin" ? t("users.makeUser") : t("users.makeAdmin")}
                      >
                        <ShieldCheck size={16} />
                      </button>
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={isSelf}
                        className="flex items-center gap-1 text-slate-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        title={user.active ? t("users.deactivate") : t("users.activate")}
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
