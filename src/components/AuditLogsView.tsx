import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  Calendar,
  User,
  Clock,
  Printer
} from "lucide-react";
import { AuditLog } from "../types";
import { getAuditLogs } from "../lib/auditStore";
import { exportToCSV, exportToExcel, exportToPDF, triggerPrintReport } from "../lib/exportUtils";

export default function AuditLogsView() {
  const [logs] = useState<AuditLog[]>(getAuditLogs());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<string>("ALL");

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchModule = moduleFilter === "ALL" || l.module === moduleFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        l.user.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.reason || "").toLowerCase().includes(q) ||
        (l.recordIdentifier || "").toLowerCase().includes(q);

      return matchModule && matchSearch;
    });
  }, [logs, moduleFilter, searchQuery]);

  const handleExport = (type: "excel" | "csv" | "pdf" | "print") => {
    const headers = ["Log ID", "Timestamp (IST)", "User", "Role", "Action", "Module", "Record ID", "Reason"];
    const rows = filteredLogs.map(l => [
      l.id,
      l.timestamp,
      l.user,
      l.role,
      l.action,
      l.module,
      l.recordIdentifier || "—",
      l.reason || "—"
    ]);

    const opts = {
      title: "System Security & Audit Ledger",
      filename: `Audit_Logs_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows
    };

    if (type === "excel") exportToExcel(opts);
    else if (type === "csv") exportToCSV(opts);
    else if (type === "pdf") exportToPDF(opts);
    else if (type === "print") triggerPrintReport(opts);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-6xl mx-auto">
      {/* Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            <span>Audit Trail & Security Logs</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Tamper-evident activity trail for authentication, mutations, deletions, and maintenance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("excel")}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => handleExport("csv")}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, user, reason, or record..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Modules</option>
            <option value="Authentication">Authentication</option>
            <option value="Employee Master">Employee Master</option>
            <option value="Attendance Entry">Attendance Entry</option>
            <option value="All Attendance Logs">All Attendance Logs</option>
            <option value="Missing Punches">Missing Punches</option>
            <option value="Data Maintenance">Data Maintenance</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                <th className="p-4 pl-6">Log ID</th>
                <th className="p-4">Timestamp (IST)</th>
                <th className="p-4">Actor</th>
                <th className="p-4">Action</th>
                <th className="p-4">Module</th>
                <th className="p-4">Record Identifier</th>
                <th className="p-4 pr-6">Justification / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredLogs.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-4 pl-6 font-mono text-slate-400 font-bold">{l.id}</td>
                  <td className="p-4 font-mono font-bold text-slate-800 whitespace-nowrap">{l.timestamp}</td>
                  <td className="p-4">
                    <span className="font-bold text-slate-900">{l.user}</span>
                    <span className="block text-[10px] text-slate-400">{l.role}</span>
                  </td>
                  <td className="p-4 font-bold text-blue-700 whitespace-nowrap">{l.action}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {l.module}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-500">{l.recordIdentifier || "—"}</td>
                  <td className="p-4 pr-6 text-slate-600 max-w-sm truncate" title={l.reason}>
                    {l.reason || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
