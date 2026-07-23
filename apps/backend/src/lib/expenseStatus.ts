export type ExpenseStatus = "draft" | "pending_review" | "validated" | "exported" | "archived";

export const EXPENSE_STATUSES: ExpenseStatus[] = [
  "draft",
  "pending_review",
  "validated",
  "exported",
  "archived",
];

export function isValidStatus(s: unknown): s is ExpenseStatus {
  return typeof s === "string" && (EXPENSE_STATUSES as string[]).includes(s);
}

/**
 * Returns whether a manual status transition is allowed.
 *
 * "exported" is set automatically by the export action and cannot be set
 * directly via this function.
 *
 * Transition table:
 *   draft          → pending_review  (owner/admin, only when requireValidation=true)
 *   draft          → archived        (owner/admin)
 *   pending_review → validated       (admin only)
 *   pending_review → draft           (admin only - reject)
 *   pending_review → archived        (admin only)
 *   validated      → archived        (admin only)
 *   exported       → archived        (admin only)
 */
export function canTransition(
  from: ExpenseStatus,
  to: ExpenseStatus,
  opts: { isAdmin: boolean; isOwner: boolean; requireValidation: boolean },
): { allowed: boolean; reason?: string } {
  if (from === to) return { allowed: false, reason: "Already in this status" };

  // "exported" can only be set by the export action, not manually
  if (to === "exported") {
    return { allowed: false, reason: "Use the export function to mark expenses as exported" };
  }

  const { isAdmin, isOwner, requireValidation } = opts;

  if (from === "draft") {
    if (to === "pending_review") {
      if (!requireValidation)
        return { allowed: false, reason: "Validation workflow is not enabled" };
      if (!isOwner && !isAdmin)
        return { allowed: false, reason: "Only the owner or an admin can submit for review" };
      return { allowed: true };
    }
    if (to === "archived") {
      if (!isOwner && !isAdmin)
        return { allowed: false, reason: "Only the owner or an admin can archive this expense" };
      return { allowed: true };
    }
  }

  if (from === "pending_review") {
    if (to === "validated" || to === "draft" || to === "archived") {
      if (!isAdmin) return { allowed: false, reason: "Only an admin can take this action" };
      return { allowed: true };
    }
  }

  if (from === "validated") {
    if (to === "archived") {
      if (!isAdmin)
        return { allowed: false, reason: "Only an admin can archive a validated expense" };
      return { allowed: true };
    }
  }

  if (from === "exported") {
    if (to === "archived") {
      if (!isAdmin)
        return { allowed: false, reason: "Only an admin can archive an exported expense" };
      return { allowed: true };
    }
  }

  return { allowed: false, reason: `Cannot transition from '${from}' to '${to}'` };
}
