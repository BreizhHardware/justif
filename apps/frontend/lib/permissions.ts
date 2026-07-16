export const PERMISSIONS = [
  "EXPORT",
  "CONFIG_OCR",
  "VIEW_DASHBOARD",
  "MANAGE_USERS",
  "MANAGE_SETTINGS",
  "VIEW_AUDIT_LOG",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
