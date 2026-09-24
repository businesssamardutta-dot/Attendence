import React, { useMemo } from "react";
import {
  Users,
  UserCheck,
  UserX,
  LogIn,
  LogOut,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { AttendanceLog, CompanyName, Employee, UserProfile, VALID_COMPANIES, COMPANY_COLORS, ActiveTab } from "../types";
import {
  extractDateKey,
  extractTime24,
  formatToIndianDate,
  formatToIndianTime,
  isLateArrival,
  calculateWorkingDuration
} from "../lib/dateUtils";

interface DashboardViewProps {
  employees: Employee[];
  logs: AttendanceLog[];
  selectedCompany: string;
  onNavigateTab: (tab: ActiveTab, filterParam?: any) => void;
  currentUser: UserProfile | null;
}

export default function DashboardView({
  employees,
  logs,
  selectedCompany,
  onNavigateTab,
  currentUser
}: DashboardViewProps) {
  // Filter by selected company scope
  const filteredEmployees = useMemo(() => {
    if (selectedCompany === "ALL") return employees;
    return employees.filter(e => e.company_name === selectedCompany);
  }, [employees, selectedCompany]);

  const filteredLogs = useMemo(() => {
    if (selectedCompany === "ALL") return logs;
    return logs.filter(l => l.company === selectedCompany);
  }, [logs, selectedCompany]);

  // Determine today's date key from latest logs or system date
  const latestDateKey = useMemo(() => {
    if (filteredLogs.length > 0) {
      const dates = filteredLogs.map(l => extractDateKey(l.timestamp)).filter(Boolean);
      dates.sort((a, b) => b.localeCompare(a));
      return dates[0] || new Date().toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  }, [filteredLogs]);

  // Calculate today's metrics
  const todayStats = useMemo(() => {
    const todayLogs = filteredLogs.filter(l => extractDateKey(l.timestamp) === latestDateKey);

    // Group logs by employee
    const empPunches: Record<string, AttendanceLog[]> = {};
    todayLogs.forEach(l => {
      const key = `${l.company}_${l.employee.trim()}`;
      if (!empPunches[key]) empPunches[key] = [];
      empPunches[key].push(l);
    });

    let checkedInToday = 0;
    let checkedOutToday = 0;
    let currentlyClockedIn = 0;
    let lateCount = 0;
    let missingPunchCount = 0;
    const activeStaffList: { company: CompanyName; employee: string; inTime: string; inLoc: string; duration: string; isLate: boolean }[] = [];

    Object.entries(empPunches).forEach(([key, punchList]) => {
      const ins = punchList.filter(p => (p.status || "").trim().toUpperCase() === "IN" || (p.status || "").trim().toLowerCase() === "check in");
      const outs = punchList.filter(p => (p.status || "").trim().toUpperCase() === "OUT" || (p.status || "").trim().toLowerCase() === "check out");

      ins.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
      outs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

      const firstIn = ins[0];
      const lastOut = outs[0];

      if (firstIn) {
        checkedInToday++;
        const inTimeStr = extractTime24(firstIn.timestamp);
        const isLate = isLateArrival(inTimeStr);
        if (isLate) lateCount++;

        // If employee has checked in but not yet checked out
        if (!lastOut || (firstIn.timestamp > lastOut.timestamp)) {
          currentlyClockedIn++;
          const duration = calculateWorkingDuration(inTimeStr, extractTime24(new Date().toISOString().replace("T", " ")));
          activeStaffList.push({
            company: firstIn.company,
            employee: firstIn.employee,
            inTime: formatToIndianTime(firstIn.timestamp),
            inLoc: firstIn.location || "Office",
            duration: duration.text,
            isLate
          });
        }
      }

      if (lastOut) {
        checkedOutToday++;
      }

      if ((firstIn && !lastOut) || (!firstIn && lastOut)) {
        missingPunchCount++;
      }
    });

    const totalEmps = filteredEmployees.length;
    const presentToday = Object.keys(empPunches).length;
    const absentToday = Math.max(0, totalEmps - presentToday);

    return {
      totalEmps,
      presentToday,
      absentToday,
      checkedInToday,
      checkedOutToday,
      currentlyClockedIn,
      lateCount,
      missingPunchCount,
      todayLogsCount: todayLogs.length,
      activeStaffList
    };
  }, [filteredEmployees, filteredLogs, latestDateKey]);

  // Chart 1: Company Comparison Data
  const companyChartData = useMemo(() => {
    return VALID_COMPANIES.map(co => {
      const coEmps = employees.filter(e => e.company_name === co).length;
      const coLogsToday = logs.filter(l => l.company === co && extractDateKey(l.timestamp) === latestDateKey);
      const uniquePresent = new Set(coLogsToday.map(l => l.employee.trim())).size;
      return {
        company: co,
        totalEmployees: coEmps,
        present: uniquePresent,
        absent: Math.max(0, coEmps - uniquePresent)
      };
    });
  }, [employees, logs, latestDateKey]);

  // Chart 2: Status Distribution
  const statusPieData = useMemo(() => {
    return [
      { name: "Present On Time", value: Math.max(0, todayStats.presentToday - todayStats.lateCount), color: "#10b981" },
      { name: "Late Arrival", value: todayStats.lateCount, color: "#f59e0b" },
      { name: "Absent", value: todayStats.absentToday, color: "#ef4444" },
      { name: "Missing Punch", value: todayStats.missingPunchCount, color: "#eab308" }
    ].filter(item => item.value > 0);
  }, [todayStats]);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Top Banner with Scope & Date info */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-bold uppercase tracking-wider">
              {selectedCompany === "ALL" ? "All 5 Enterprise Entities" : `Company: ${selectedCompany}`}
            </span>
            <span className="text-xs text-slate-300">• Live Roster Analysis</span>
          </div>
          <h1 className="text-2xl font-black font-display tracking-tight text-white mt-1">
            Attendance Operations Dashboard
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-0.5">
            Active reporting date: <span className="font-mono font-bold text-white">{formatToIndianDate(latestDateKey)}</span> (Indian Standard Time)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigateTab("attendance_entry")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            <span>Attendance Punch</span>
          </button>
          <button
            onClick={() => onNavigateTab("reports")}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <span>Generate Reports</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {/* Total Employees */}
        <div
          onClick={() => onNavigateTab("employee_master")}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Workforce</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-display mt-2">
            {todayStats.totalEmps}
          </div>
          <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1 mt-1">
            <span>Manage Master</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>

        {/* Present Today */}
        <div
          onClick={() => onNavigateTab("reports", { reportType: "present" })}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-emerald-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Present Today</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-display mt-2">
            {todayStats.presentToday}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            {todayStats.totalEmps > 0 ? Math.round((todayStats.presentToday / todayStats.totalEmps) * 100) : 0}% Turnout
          </span>
        </div>

        {/* Absent Today */}
        <div
          onClick={() => onNavigateTab("reports", { reportType: "absent" })}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-rose-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Absent Today</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 font-display mt-2">
            {todayStats.absentToday}
          </div>
          <span className="text-[10px] text-rose-500 font-medium mt-1 block">
            No punch recorded
          </span>
        </div>

        {/* Checked In */}
        <div
          onClick={() => onNavigateTab("reports", { reportType: "checkin" })}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-indigo-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Punch IN Today</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600 font-display mt-2">
            {todayStats.checkedInToday}
          </div>
          <span className="text-[10px] text-indigo-500 font-medium mt-1 block">
            Arrivals recorded
          </span>
        </div>

        {/* Checked Out */}
        <div
          onClick={() => onNavigateTab("reports", { reportType: "checkout" })}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-purple-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Punch OUT Today</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 font-display mt-2">
            {todayStats.checkedOutToday}
          </div>
          <span className="text-[10px] text-purple-500 font-medium mt-1 block">
            Departures completed
          </span>
        </div>

        {/* Late Employees */}
        <div
          onClick={() => onNavigateTab("reports", { reportType: "late" })}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-amber-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Late Arrivals</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 font-display mt-2">
            {todayStats.lateCount}
          </div>
          <span className="text-[10px] text-amber-600 font-medium mt-1 block">
            After 09:30 AM grace
          </span>
        </div>

        {/* Missing Punches */}
        <div
          onClick={() => onNavigateTab("missing_punches")}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-amber-500 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Missing Punches</span>
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl group-hover:scale-110 transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 font-display mt-2">
            {todayStats.missingPunchCount}
          </div>
          <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1 mt-1">
            <span>Fix Mismatches</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>

        {/* Currently Clocked In */}
        <div
          onClick={() => onNavigateTab("live_attendance")}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Currently On Duty</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-blue-600 font-display mt-2">
            {todayStats.currentlyClockedIn}
          </div>
          <span className="text-[10px] text-blue-500 font-medium mt-1 block">
            Live in facility
          </span>
        </div>

        {/* Today's Total Logs */}
        <div
          onClick={() => onNavigateTab("all_attendance_logs")}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-slate-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today's Logs</span>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl group-hover:scale-110 transition">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 font-display mt-2">
            {todayStats.todayLogsCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Raw punches today
          </span>
        </div>

        {/* Total Database Logs */}
        <div
          onClick={() => onNavigateTab("all_attendance_logs")}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-slate-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Stored Logs</span>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl group-hover:scale-110 transition">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 font-display mt-2">
            {filteredLogs.length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Combined database
          </span>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company-Wise Comparison Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base font-display">
                Company-Wise Turnout Breakdown
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Workforce capacity vs today's present head count across the 5 authorized companies
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
              5 Entities
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={companyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="company" tick={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="totalEmployees" name="Total Workforce" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="present" name="Present Today" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Donut Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base font-display">
              Turnout Distribution
            </h3>
            <p className="text-xs text-slate-400 font-medium mb-2">
              Proportion of present, late, missing, and absent
            </p>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900 font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LIVE CLOCKED-IN STAFF TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-base font-display">
                Currently Clocked-In Personnel
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Live staff who have punched IN today without a corresponding Punch OUT
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab("live_attendance")}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Open Live Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                <th className="p-4 pl-6">Company</th>
                <th className="p-4">Employee</th>
                <th className="p-4">Punch IN (IST)</th>
                <th className="p-4">Punch Location</th>
                <th className="p-4">Shift Duration</th>
                <th className="p-4 pr-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {todayStats.activeStaffList.length > 0 ? (
                todayStats.activeStaffList.slice(0, 8).map((staff, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 pl-6 whitespace-nowrap">
                      <span
                        className="px-2.5 py-1 rounded-md text-[10px] font-extrabold text-white uppercase tracking-wider"
                        style={{ backgroundColor: COMPANY_COLORS[staff.company]?.hex || "#475569" }}
                      >
                        {staff.company}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-bold text-slate-900">
                      {staff.employee}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono font-bold text-emerald-700">
                      {staff.inTime}
                    </td>
                    <td className="p-4 text-slate-500 max-w-xs truncate" title={staff.inLoc}>
                      {staff.inLoc}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-800">
                      {staff.duration}
                    </td>
                    <td className="p-4 pr-6 text-center whitespace-nowrap">
                      {staff.isLate ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                          Late Arrival
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          On Duty
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    No staff currently clocked in or active on duty.
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
