"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiFetch, ApiError } from "@/lib/api";
import { Badge, Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
}

function toggleSetMember(set: Set<Permission>, permission: Permission): Set<Permission> {
  const next = new Set(set);
  if (next.has(permission)) next.delete(permission);
  else next.add(permission);
  return next;
}

export default function RolesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newPermissions, setNewPermissions] = useState<Set<Permission>>(new Set());
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPermissions, setEditPermissions] = useState<Set<Permission>>(new Set());
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setRoles(await apiFetch<Role[]>("/api/roles"));
  }

  useEffect(() => {
    load().catch(() => router.replace("/expenses"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setCreateError(null);
    setCreating(true);
    try {
      await apiFetch("/api/roles", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          permissions: Array.from(newPermissions),
        }),
      });
      setName("");
      setDescription("");
      setNewPermissions(new Set());
      await load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : t("roles.createError"));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditName(role.name);
    setEditDescription(role.description ?? "");
    setEditPermissions(new Set(role.permissions));
    setEditError(null);
  }

  async function saveEdit(roleId: string) {
    setEditError(null);
    try {
      await apiFetch(`/api/roles/${roleId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          description: editDescription || undefined,
          permissions: Array.from(editPermissions),
        }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : t("roles.updateError"));
    }
  }

  async function handleDelete(role: Role) {
    setDeleteError(null);
    try {
      await apiFetch(`/api/roles/${role.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t("roles.deleteError"));
    }
  }

  function permissionLabel(permission: Permission): string {
    return t(`roles.permissionLabels.${permission}`);
  }

  return (
    <AppShell>
      <PageHeader title={t("roles.title")} />

      <Card className="mb-6 max-w-xl p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("roles.newRoleTitle")}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="roleName">{t("roles.name")}</Label>
            <Input id="roleName" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="roleDescription">{t("roles.description")}</Label>
            <Input
              id="roleDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("roles.permissions")}</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PERMISSIONS.map((permission) => (
                <label key={permission} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={newPermissions.has(permission)}
                    onChange={() => setNewPermissions(toggleSetMember(newPermissions, permission))}
                  />
                  {permissionLabel(permission)}
                </label>
              ))}
            </div>
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <Button type="submit" disabled={creating}>
            <Plus size={16} />
            {t("roles.create")}
          </Button>
        </form>
      </Card>

      {deleteError && <p className="mb-4 text-sm text-red-600">{deleteError}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("roles.name")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("roles.permissions")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("roles.usersCount")}
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {roles?.map((role) => {
              const isEditing = editingId === role.id;
              return (
                <tr key={role.id} className="border-b border-slate-50 last:border-0">
                  {isEditing ? (
                    <td colSpan={4} className="px-4 py-3">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="max-w-xs"
                          />
                          <Input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder={t("roles.description")}
                            className="max-w-xs"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {PERMISSIONS.map((permission) => (
                            <label
                              key={permission}
                              className="flex items-center gap-1.5 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={editPermissions.has(permission)}
                                onChange={() =>
                                  setEditPermissions(toggleSetMember(editPermissions, permission))
                                }
                              />
                              {permissionLabel(permission)}
                            </label>
                          ))}
                        </div>
                        {editError && <p className="text-sm text-red-600">{editError}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(role.id)}>
                            {t("roles.save")}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                            {t("roles.cancel")}
                          </Button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-900">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-slate-500">{role.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {role.permissions.length > 0 ? (
                            role.permissions.map((permission) => (
                              <Badge key={permission} tone="blue">
                                {permissionLabel(permission)}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">{role.userCount}</td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => startEdit(role)}
                            className="flex items-center gap-1 text-slate-500 transition hover:text-brand-600"
                            title={t("roles.edit")}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(role)}
                            disabled={role.userCount > 0}
                            className="flex items-center gap-1 text-slate-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              role.userCount > 0
                                ? t("roles.deleteBlocked", { count: role.userCount })
                                : t("roles.delete")
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
