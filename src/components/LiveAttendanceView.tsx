import React, { useState, useMemo } from "react";
import {
  Radio,
  Search,
  Building2,
  Clock,
  MapPin,
  LogIn,
  LogOut,
  UserCheck,
  Filter,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { AttendanceLog, CompanyName, Employee, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import { extractDateKey, extractTime24, formatToIndianDate, formatToIndianTime, calculateWorkingDuration, isLateArrival } from "../lib/dateUtils";

interface LiveAttendanceViewProps {
  employees: Employee[];
  logs: AttendanceLog[];
  selectedGlobalCompany: string;
  currentUser: UserProfile | null;
}

export default function LiveAttendanceView({
  employees,
  logs,
  selectedGlobalCompany,
  currentUser
}: LiveAttendanceViewProps) {
  const [filterCompany, setFilterCompany] = useState<string>(selectedGlobalCompany || "ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ON_DUTY" | "CHECKED_OUT">("ALL");

  // Determine today's date key
  const todayDateKey = useMemo(() => {
    if (logs.length > 0) {
      const dates = logs.map(l => extractDateKey(l.timestamp)).filter(Boolean);
      dates.sort((a, b) => b.localeCompare(a));
      return dates[0] || new Date().toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  }, [logs]);

  // Aggregate live shift state for today
  const liveRoster = useMemo(() => {
    const todayLogs = logs.filter(l => extractDateKey(l.timestamp) === todayDateKey);

    // Group logs by company + employee
    const grouped: Record<string, { company: CompanyName; employee: string; punches: AttendanceLog[] }> = {};

    todayLogs.forEach(l => {
      const key = `${l.company}_${l.employee.trim()}`;
      if (!grouped[key]) {
        grouped[key] = { company: l.company, employee: l.employee, punches: [] };
      }
      grouped[key].punches.push(l);
    });

    const list: any[] = [];
    Object.values(grouped).forEach(item => {
      const ins = item.punches.filter(p => (p.status || "").trim().toUpperCase() === "IN" || (p.status || "").trim().toLowerCase() === "check in");
      const outs = item.punches.filter(p => (p.status || "").trim().toUpperCase() === "OUT" || (p.status || "").trim().toLowerCase() === "check out");

      ins.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
      outs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

      const firstIn = ins[0];
      const lastOut = outs[0];

      const inTime24 = firstIn ? extractTime24(firstIn.timestamp) : "";
      const outTime24 = lastOut ? extractTime24(lastOut.timestamp) : "";
      const isLate = inTime24 ? isLateArrival(inTime24) : false;

      const isOnDuty = firstIn && (!lastOut || (firstIn.timestamp > lastOut.timestamp));
      const isCompleted = firstIn && lastOut && (lastOut.timestamp >= firstIn.timestamp);

      const duration = isCompleted
        ? calculateWorkingDuration(inTime24, outTime24).text
        : isOnDuty
        ? calculateWorkingDuration(inTime24, extractTime24(new Date().toISOString().replace("T", " "))).text
        : "—";

      list.push({
        company: item.company,
        employee: item.employee,
        firstInTime: firstIn ? formatToIndianTime(firstIn.timestamp) : "—",
        firstInLocation: firstIn?.location || "—",
        lastOutTime: lastOut ? formatToIndianTime(lastOut.timestamp) : "—",
        lastOutLocation: lastOut?.location || "—",
        isOnDuty,
        isCompleted,
        isLate,
        duration,
        totalPunches: item.punches.length
      });
    });

    // Sort: On Duty first, then alphabetical
    list.sort((a, b) => {
      if (a.isOnDuty && !b.isOnDuty) return -1;
      if (!a.isOnDuty && b.isOnDuty) return 1;
      return a.employee.localeCompare(b.employee);
    });

    return list;
  }, [logs, todayDateKey]);

  // Filtered live list
  const filteredList = useMemo(() => {
    return liveRoster.filter(item => {
      const matchCompany = filterCompany === "ALL" || item.company === filterCompany;
      const matchSearch =
        item.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.firstInLocation.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ON_DUTY" && item.isOnDuty) ||
        (statusFilter === "CHECKED_OUT" && item.isCompleted);

      return matchCompany && matchSearch && matchStatus;
    });
  }, [liveRoster, filterCompany, searchQuery, statusFilter]);

  const onDutyCount = liveRoster.filter(i => i.isOnDuty).length;
  const completedCount = liveRoster.filter(i => i.isCompleted).length;

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Live Facility Operations
            </span>
          </div>
          <h1 className="text-2xl font-black font-display tracking-tight text-white mt-1">
            Real-Time Workforce Monitor
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-0.5">
            Monitoring active punches for date: <strong className="font-mono text-white">{formatToIndianDate(todayDateKey)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800/90 border border-slate-700/80 px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">On Duty Now</span>
              <span className="text-lg font-black text-emerald-400 font-display">{onDutyCount} Staff</span>
            </div>
          </div>

          <div className="bg-slate-800/90 border border-slate-700/80 px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <LogOut className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Completed Shift</span>
              <span className="text-lg font-black text-purple-300 font-display">{completedCount} Staff</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee, company, or terminal location..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Status filter toggle buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All ({liveRoster.length})
            </button>
            <button
              onClick={() => setStatusFilter("ON_DUTY")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === "ON_DUTY" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              On Duty ({onDutyCount})
            </button>
            <button
              onClick={() => setStatusFilter("CHECKED_OUT")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                statusFilter === "CHECKED_OUT" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Checked Out ({completedCount})
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
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
      </div>

      {/* Live Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                <th className="p-4 pl-6">Company</th>
                <th className="p-4">Employee</th>
                <th className="p-4">Punch IN Time</th>
                <th className="p-4">Punch IN Terminal</th>
                <th className="p-4">Punch OUT Time</th>
                <th className="p-4">Punch OUT Terminal</th>
                <th className="p-4">Live Shift Time</th>
                <th className="p-4 pr-6 text-center">Duty Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredList.length > 0 ? (
                filteredList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 pl-6 whitespace-nowrap">
                      <span
                        className="px-2.5 py-1 rounded-md text-[10px] font-extrabold text-white uppercase tracking-wider"
                        style={{ backgroundColor: COMPANY_COLORS[item.company]?.hex || "#475569" }}
                      >
                        {item.company}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-bold text-slate-900">
                      {item.employee}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono font-bold text-emerald-700">
                      {item.firstInTime}
                    </td>
                    <td className="p-4 text-slate-500 max-w-xs truncate" title={item.firstInLocation}>
                      {item.firstInLocation}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono font-bold text-rose-700">
                      {item.lastOutTime}
                    </td>
                    <td className="p-4 text-slate-500 max-w-xs truncate" title={item.lastOutLocation}>
                      {item.lastOutLocation}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono font-extrabold text-slate-800">
                      {item.duration}
                    </td>
                    <td className="p-4 pr-6 text-center whitespace-nowrap">
                      {item.isOnDuty ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>On Duty</span>
                          {item.isLate && <span className="text-amber-600 font-black">• Late</span>}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-purple-600" />
                          <span>Shift Ended</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                    No active staff found matching your current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
