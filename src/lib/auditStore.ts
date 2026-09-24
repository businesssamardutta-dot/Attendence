import { AuditLog, UserRole } from "../types";
import { formatToIndianDateTime, getCurrentISTDatabaseTimestamp } from "./dateUtils";

const AUDIT_STORAGE_KEY = "attendance_mgmt_audit_logs";

export function getAuditLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to read audit logs:", e);
  }

  // Initial seed audit logs
  return [
    {
      id: "AUD-001",
      timestamp: formatToIndianDateTime(getCurrentISTDatabaseTimestamp()),
      user: "System",
      role: "Administrator",
      action: "System Initialized",
      module: "Security",
      reason: "Supabase connection verified for 5 active companies."
    }
  ];
}

export function logAuditEvent(entry: {
  user: string;
  role: UserRole;
  action: string;
  module: string;
  company?: string;
  recordIdentifier?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
}): AuditLog {
  const currentLogs = getAuditLogs();
  const newLog: AuditLog = {
    id: `AUD-${Date.now().toString().slice(-6)}`,
    timestamp: formatToIndianDateTime(getCurrentISTDatabaseTimestamp()),
    user: entry.user || "Admin",
    role: entry.role || "Administrator",
    action: entry.action,
    module: entry.module,
    company: entry.company,
    recordIdentifier: entry.recordIdentifier,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    reason: entry.reason,
    ipAddress: "127.0.0.1 (Local Session)"
  };

  const updated = [newLog, ...currentLogs].slice(0, 1000); // keep last 1000 logs
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Audit log storage write failed:", e);
  }

  return newLog;
}
