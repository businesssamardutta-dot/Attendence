import React, { useState, useMemo } from "react";
import {
  Trash2,
  AlertOctagon,
  Download,
  ShieldAlert,
  Calendar,
  Building2,
  CheckCircle2,
  Lock,
  Archive
} from "lucide-react";
import { AttendanceLog, CompanyName, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import { deleteLogsBeforeCutoff } from "../lib/supabaseClient";
import { exportToExcel } from "../lib/exportUtils";
import { logAuditEvent } from "../lib/auditStore";
import { formatToIndianDate, formatToIndianTime } from "../lib/dateUtils";

interface DataMaintenanceViewProps {
  logs: AttendanceLog[];
  onRefreshLogs: () => Promise<void>;
  currentUser: UserProfile | null;
}

export default function DataMaintenanceView({
  logs,
  onRefreshLogs,
  currentUser
}: DataMaintenanceViewProps) {
  const CUTOFF_DATE = "2026-04-01 00:00:00";
  const CONFIRMATION_PHRASE = "DELETE PERMANENTLY";

  const [enteredPhrase, setEnteredPhrase] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<string>("");
  const [hasBackedUp, setHasBackedUp] = useState<boolean>(false);

  // Calculate affected records per company earlier than cutoff
  const affectedStats = useMemo(() => {
    const stats: Record<CompanyName, number> = {
      BHANGAKUTHI: 0,
      HB: 0,
      "HB-TP": 0,
      HBPL: 0,
      SEFALI: 0
    };

    let total = 0;
    const oldLogs: AttendanceLog[] = [];

    logs.forEach(l => {
      if (l.timestamp && l.timestamp < CUTOFF_DATE) {
        if (stats[l.company] !== undefined) {
          stats[l.company]++;
          total++;
          oldLogs.push(l);
        }
      }
    });

    return { stats, total, oldLogs };
  }, [logs]);

  // Export Backup
  const handleExportBackup = () => {
    const headers = ["Composite ID", "Company", "Employee", "Timestamp (IST)", "Status", "Location"];
    const rows = affectedStats.oldLogs.map(l => [
      l.compositeId || `${l.company}-${l.id}`,
      l.company,
      l.employee,
      l.timestamp,
      l.status,
      l.location
    ]);

    exportToExcel({
      title: "Attendance Archive Backup (Pre-2026-04-01)",
      filename: `Archive_Backup_Pre_2026_04_01_${Date.now()}`,
      headers,
      rows,
      metaInfo: {
        "Cutoff Date": CUTOFF_DATE,
        "Total Archive Records": String(affectedStats.total),
        "Exported By": currentUser?.username || "Admin"
      }
    });

    setHasBackedUp(true);
  };

  // Perform Destructive Purge
  const handleExecutePurge = async () => {
    if (enteredPhrase !== CONFIRMATION_PHRASE) {
      alert(`Please type '${CONFIRMATION_PHRASE}' exactly to confirm.`);
      return;
    }

    if (currentUser?.role !== "Administrator") {
      alert("Only users with the Administrator role can execute database cleanup.");
      return;
    }

    setIsProcessing(true);
    setResultMessage("");

    try {
      const results = await deleteLogsBeforeCutoff(CUTOFF_DATE);
      const totalPurged = results.reduce((sum, r) => sum + r.deletedCount, 0);

      logAuditEvent({
        user: currentUser?.username || "Admin",
        role: currentUser?.role || "Administrator",
        action: "Destructive Purge Executed",
        module: "Data Maintenance",
        newValue: `Deleted ${totalPurged} records before cutoff ${CUTOFF_DATE}`,
        reason: `Administrator database maintenance. Company breakdown: ${JSON.stringify(results)}`
      });

      setResultMessage(
        `Successfully deleted ${totalPurged} records across all 5 company tables earlier than ${CUTOFF_DATE}.`
      );
      setEnteredPhrase("");
      await onRefreshLogs();
    } catch (err: any) {
      alert("Purge failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-4xl mx-auto">
      {/* Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-[10px] font-bold uppercase tracking-wider">
              Protected Administrator Module
            </span>
          </div>
          <h1 className="text-2xl font-black font-display tracking-tight text-white mt-1">
            Database Maintenance & Cutoff Cleanup
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-0.5">
            Explicit, audit-trailed removal of legacy records prior to specified financial cutoff
          </p>
        </div>

        <div className="bg-rose-900/40 border border-rose-700/60 px-4 py-2.5 rounded-2xl flex items-center gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-400" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Affected Records</span>
            <span className="text-xl font-black text-rose-300 font-display">{affectedStats.total} Found</span>
          </div>
        </div>
      </div>

      {resultMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{resultMessage}</span>
        </div>
      )}

      {/* Breakdown per company */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
        <h3 className="font-extrabold text-base font-display text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <span>Records Prior to Cutoff ({CUTOFF_DATE})</span>
        </h3>
        <p className="text-xs text-slate-500">
          Distribution of historical attendance records earlier than <strong className="text-slate-800 font-mono">01-04-2026 00:00:00</strong> across individual company tables:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {VALID_COMPANIES.map(co => (
            <div
              key={co}
              className="p-4 rounded-2xl border text-center"
              style={{ borderColor: `${COMPANY_COLORS[co]?.hex}40` || "#cbd5e1" }}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{co}</span>
              <span className="text-2xl font-black text-slate-900 font-display block my-1">
                {affectedStats.stats[co] || 0}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Table: {co}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Protocol 1: Backup */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-sm font-display text-slate-900">
              Step 1: Export Complete Archive Backup
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Always download an Excel archive of the affected {affectedStats.total} records before permanent deletion.
          </p>
        </div>

        <button
          onClick={handleExportBackup}
          disabled={affectedStats.total === 0}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs ${
            hasBackedUp
              ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
          }`}
        >
          {hasBackedUp ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
          <span>{hasBackedUp ? "Archive Downloaded" : "Download Excel Archive"}</span>
        </button>
      </div>

      {/* Safety Protocol 2: Destructive Execution */}
      <div className="bg-rose-50/50 rounded-3xl border border-rose-200/80 p-6 space-y-4">
        <div className="flex items-center gap-2 text-rose-800">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <h3 className="font-extrabold text-sm font-display">
            Step 2: Confirm Permanent Destruction
          </h3>
        </div>

        <p className="text-xs text-rose-700">
          This operation is irreversible. Records deleted cannot be restored without a manual backup import. To proceed, please type <code className="font-bold bg-white px-2 py-0.5 rounded border border-rose-300">{CONFIRMATION_PHRASE}</code> below:
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={enteredPhrase}
            onChange={(e) => setEnteredPhrase(e.target.value)}
            placeholder={`Type '${CONFIRMATION_PHRASE}'`}
            className="flex-1 px-4 py-2.5 bg-white border border-rose-300 rounded-xl text-xs font-mono font-bold text-rose-900 placeholder:text-rose-300 focus:outline-none focus:border-rose-600"
          />

          <button
            onClick={handleExecutePurge}
            disabled={enteredPhrase !== CONFIRMATION_PHRASE || isProcessing || affectedStats.total === 0}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <span>Executing Database Purge...</span>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Execute Permanent Purge</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
