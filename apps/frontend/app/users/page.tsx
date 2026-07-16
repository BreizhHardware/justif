"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, UserMinus, UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiFetch, ApiError } from "@/lib/api";
import { Badge, Button, Card, Input, Label, PageHeader } from "@/components/ui";

interface RoleRef {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  roles: RoleRef[];
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<RoleRef[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRoleIds, setNewRoleIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<Set<string>>(new Set());
  const [editError, setEditError] = useState<string | null>(null);

  async function load() {
    const [list, roleList, me] = await Promise.all([
      apiFetch<User[]>("/api/users"),
      apiFetch<Array<RoleRef & { permissions: string[] }>>("/api/roles"),
      apiFetch<{ email: string }>("/api/auth/me"),
    ]);
    setUsers(list);
    setRoles(roleList);
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
        body: JSON.stringify({ email, password, roleIds: Array.from(newRoleIds) }),
      });
      setEmail("");
      setPassword("");
      setNewRoleIds(new Set());
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

  function startEditRoles(user: User) {
    setEditingId(user.id);
    setEditRoleIds(new Set(user.roles.map((r) => r.id)));
    setEditError(null);
  }

  async function saveRoles(userId: string) {
    setEditError(null);
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ roleIds: Array.from(editRoleIds) }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : t("users.updateError"));
    }
  }

  function toggleSetMember(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
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
            <Label>{t("users.roles")}</Label>
            <div className="flex flex-wrap gap-3">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={newRoleIds.has(role.id)}
                    onChange={() => setNewRoleIds(toggleSetMember(newRoleIds, role.id))}
                  />
                  {role.name}
                </label>
              ))}
            </div>
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
                {t("users.roles")}
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
              const isEditing = editingId === user.id;
              return (
                <tr key={user.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 align-top">
                    {user.email}
                    {isSelf && (
                      <span className="ml-2 text-xs text-slate-400">({t("users.you")})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-3">
                          {roles.map((role) => (
                            <label
                              key={role.id}
                              className="flex items-center gap-1.5 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={editRoleIds.has(role.id)}
                                onChange={() =>
                                  setEditRoleIds(toggleSetMember(editRoleIds, role.id))
                                }
                              />
                              {role.name}
                            </label>
                          ))}
                        </div>
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveRoles(user.id)}>
                            {t("users.saveRoles")}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                            {t("users.cancelEdit")}
                          </Button>
                        </div>
                      </div>
                    ) : user.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.map((role) => (
                          <Badge key={role.id} tone="brand">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{t("users.noRoles")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Badge tone={user.active ? "brand" : "amber"}>
                      {user.active ? t("users.active") : t("users.inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex justify-end gap-3">
                      {!isEditing && (
                        <button
                          onClick={() => startEditRoles(user)}
                          className="flex items-center gap-1 text-slate-500 transition hover:text-brand-600"
                          title={t("users.editRoles")}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
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
