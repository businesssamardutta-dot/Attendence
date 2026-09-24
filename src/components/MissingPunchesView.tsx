import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Search,
  Building2,
  Clock,
  PlusCircle,
  CheckCircle2,
  Filter,
  Calendar,
  ArrowRight,
  Sparkles,
  X
} from "lucide-react";
import { AttendanceLog, CompanyName, Employee, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import {
  extractDateKey,
  extractTime24,
  formatToIndianDate,
  formatToIndianTime
} from "../lib/dateUtils";
import { insertAttendanceLog } from "../lib/supabaseClient";
import { logAuditEvent } from "../lib/auditStore";

interface MissingPunchesViewProps {
  logs: AttendanceLog[];
  employees: Employee[];
  onRefreshLogs: () => Promise<void>;
  selectedGlobalCompany: string;
  currentUser: UserProfile | null;
}

export default function MissingPunchesView({
  logs,
  employees,
  onRefreshLogs,
  selectedGlobalCompany,
  currentUser
}: MissingPunchesViewProps) {
  const [companyFilter, setCompanyFilter] = useState<string>(selectedGlobalCompany || "ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [resolvingItem, setResolvingItem] = useState<any | null>(null);

  // Form states for resolution
  const [resolveTime, setResolveTime] = useState<string>("18:30:00");
  const [resolveStatus, setResolveStatus] = useState<"OUT" | "IN">("OUT");
  const [resolveLocation, setResolveLocation] = useState<string>("Office Main Terminal");
  const [resolveReason, setResolveReason] = useState<string>("Forgot biometric punch at exit, verified with CCTV/manager");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Scan logs for missing punches (employees with only IN or only OUT on a given date)
  const missingPunchesList = useMemo(() => {
    // Group logs by company + employee + date
    const groups: Record<string, { company: CompanyName; employee: string; date: string; punches: AttendanceLog[] }> = {};

    logs.forEach(l => {
      const dateKey = extractDateKey(l.timestamp);
      if (!dateKey) return;
      const key = `${l.company}_${l.employee.trim()}_${dateKey}`;
      if (!groups[key]) {
        groups[key] = { company: l.company, employee: l.employee, date: dateKey, punches: [] };
      }
      groups[key].punches.push(l);
    });

    const result: any[] = [];

    Object.values(groups).forEach(g => {
      const ins = g.punches.filter(p => (p.status || "").toUpperCase() === "IN" || (p.status || "").toLowerCase() === "check in");
      const outs = g.punches.filter(p => (p.status || "").toUpperCase() === "OUT" || (p.status || "").toLowerCase() === "check out");

      if (ins.length > 0 && outs.length === 0) {
        // Missing punch out
        ins.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
        const firstIn = ins[0];
        result.push({
          id: `${g.company}_${g.employee}_${g.date}_MISSING_OUT`,
          company: g.company,
          employee: g.employee,
          date: g.date,
          missingType: "Missing OUT Punch",
          existingTime: formatToIndianTime(firstIn.timestamp),
          existingTimestamp: firstIn.timestamp,
          existingLocation: firstIn.location || "Office",
          suggestedStatus: "OUT",
          suggestedTime: "18:30:00"
        });
      } else if (ins.length === 0 && outs.length > 0) {
        // Missing punch in
        outs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
        const lastOut = outs[0];
        result.push({
          id: `${g.company}_${g.employee}_${g.date}_MISSING_IN`,
          company: g.company,
          employee: g.employee,
          date: g.date,
          missingType: "Missing IN Punch",
          existingTime: formatToIndianTime(lastOut.timestamp),
          existingTimestamp: lastOut.timestamp,
          existingLocation: lastOut.location || "Office",
          suggestedStatus: "IN",
          suggestedTime: "09:00:00"
        });
      }
    });

    // Sort by date descending
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [logs]);

  // Filtered
  const filteredList = useMemo(() => {
    return missingPunchesList.filter(item => {
      const matchCo = companyFilter === "ALL" || item.company === companyFilter;
      const matchSearch =
        item.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.date.includes(searchQuery);
      return matchCo && matchSearch;
    });
  }, [missingPunchesList, companyFilter, searchQuery]);

  const handleOpenResolve = (item: any) => {
    setResolvingItem(item);
    setResolveStatus(item.suggestedStatus);
    setResolveTime(item.suggestedTime);
    setResolveLocation(item.existingLocation);
    setResolveReason("Forgot punch, verified with site supervisor");
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingItem) return;

    setIsSubmitting(true);
    setSuccessMsg("");

    try {
      const fullTimestamp = `${resolvingItem.date} ${resolveTime}`;

      await insertAttendanceLog({
        company: resolvingItem.company,
        employee: resolvingItem.employee,
        timestamp: fullTimestamp,
        status: resolveStatus,
        location: resolveLocation
      });

      logAuditEvent({
        user: currentUser?.username || "Admin",
        role: currentUser?.role || "Administrator",
        action: "Missing Punch Resolved",
        module: "Missing Punches",
        company: resolvingItem.company,
        recordIdentifier: `${resolvingItem.company}-${resolvingItem.employee}-${resolvingItem.date}`,
        newValue: `Added ${resolveStatus} punch at ${fullTimestamp}`,
        reason: resolveReason
      });

      setSuccessMsg(`Successfully paired ${resolveStatus} punch for ${resolvingItem.employee} on ${formatToIndianDate(resolvingItem.date)}.`);
      await onRefreshLogs();
      setResolvingItem(null);
    } catch (err: any) {
      alert("Error resolving missing punch: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-amber-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
              Discrepancy Audit
            </span>
          </div>
          <h1 className="text-2xl font-black font-display tracking-tight text-white mt-1">
            Missing Punches & Discrepancies
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-0.5">
            Identify single-punch records and quickly pair missing check-in or check-out times
          </p>
        </div>

        <div className="bg-slate-800/90 border border-slate-700/80 px-4 py-2.5 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Unresolved Mismatches</span>
            <span className="text-xl font-black text-amber-300 font-display">{missingPunchesList.length} Found</span>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee, company, or date..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-500">Company:</span>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Companies</option>
            {VALID_COMPANIES.map(co => (
              <option key={co} value={co}>
                {co}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Missing Punches Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                <th className="p-4 pl-6">Company</th>
                <th className="p-4">Employee</th>
                <th className="p-4">Date (IST)</th>
                <th className="p-4">Recorded Punch</th>
                <th className="p-4">Location</th>
                <th className="p-4">Discrepancy Status</th>
                <th className="p-4 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredList.length > 0 ? (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 pl-6 whitespace-nowrap">
                      <span
                        className="px-2.5 py-1 rounded-md text-[10px] font-extrabold text-white uppercase tracking-wider"
                        style={{ backgroundColor: COMPANY_COLORS[item.company as CompanyName]?.hex || "#475569" }}
                      >
                        {item.company}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-bold text-slate-900">
                      {item.employee}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-700">
                      {formatToIndianDate(item.date)}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-800">
                      {item.existingTime}
                    </td>
                    <td className="p-4 text-slate-500 max-w-xs truncate" title={item.existingLocation}>
                      {item.existingLocation}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>{item.missingType}</span>
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenResolve(item)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto shadow-2xs cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Pair Punch</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    No missing punch discrepancies found! All attendance records are fully paired.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESOLUTION MODAL */}
      {resolvingItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Resolve Discrepancy</span>
                <h3 className="font-extrabold text-base font-display text-white">
                  Add Missing {resolveStatus} Punch
                </h3>
                <p className="text-xs text-slate-300">
                  {resolvingItem.employee} ({resolvingItem.company}) • {formatToIndianDate(resolvingItem.date)}
                </p>
              </div>
              <button onClick={() => setResolvingItem(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
                <span className="font-bold">Existing Punch:</span> {resolvingItem.existingTime} at {resolvingItem.existingLocation}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Missing Punch Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolveStatus("IN")}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      resolveStatus === "IN" ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    Punch IN (Check In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveStatus("OUT")}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      resolveStatus === "OUT" ? "bg-rose-600 text-white border-rose-600" : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    Punch OUT (Check Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Punch Time (HH:mm:ss)
                </label>
                <input
                  type="time"
                  step="1"
                  required
                  value={resolveTime}
                  onChange={(e) => setResolveTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Location / Terminal
                </label>
                <input
                  type="text"
                  required
                  value={resolveLocation}
                  onChange={(e) => setResolveLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Resolution Justification (Audit Log)
                </label>
                <input
                  type="text"
                  required
                  value={resolveReason}
                  onChange={(e) => setResolveReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Commit Punch Pair"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
