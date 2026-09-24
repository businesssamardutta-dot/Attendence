import React, { useState, useMemo } from "react";
import {
  Clock,
  Building2,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Send,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { AttendanceLog, AttendanceStatus, CompanyName, Employee, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import { insertAttendanceLog } from "../lib/supabaseClient";
import { getCurrentISTDatabaseTimestamp, formatToIndianDate, formatToIndianTime, formatToIndianDateTime } from "../lib/dateUtils";
import { logAuditEvent } from "../lib/auditStore";

interface AttendanceEntryViewProps {
  employees: Employee[];
  onRefreshLogs: () => Promise<void>;
  currentUser: UserProfile | null;
  defaultCompany?: string;
}

export default function AttendanceEntryView({
  employees,
  onRefreshLogs,
  currentUser,
  defaultCompany
}: AttendanceEntryViewProps) {
  const [selectedCompany, setSelectedCompany] = useState<CompanyName>(
    defaultCompany && VALID_COMPANIES.includes(defaultCompany as CompanyName)
      ? (defaultCompany as CompanyName)
      : "BHANGAKUTHI"
  );
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [punchDate, setPunchDate] = useState<string>(
    new Date().toLocaleDateString("en-CA") // YYYY-MM-DD
  );
  const [punchTime, setPunchTime] = useState<string>(
    new Date().toLocaleTimeString("en-GB", { hour12: false }) // HH:mm:ss
  );
  const [punchStatus, setPunchStatus] = useState<AttendanceStatus>("Check In");
  const [punchLocation, setPunchLocation] = useState<string>("Burdwan Office Desk");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [recentEntries, setRecentEntries] = useState<AttendanceLog[]>([]);

  // Filter employees for selected company
  const companyEmployees = useMemo(() => {
    return employees.filter(e => e.company_name === selectedCompany);
  }, [employees, selectedCompany]);

  // Set default employee when company changes
  React.useEffect(() => {
    if (companyEmployees.length > 0) {
      setSelectedEmployee(companyEmployees[0].employee_name);
    } else {
      setSelectedEmployee("");
    }
  }, [selectedCompany, companyEmployees]);

  const STATUS_OPTIONS: { label: string; value: AttendanceStatus; icon: any; color: string }[] = [
    { label: "Check In (IN)", value: "Check In", icon: LogIn, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { label: "Check Out (OUT)", value: "Check Out", icon: LogOut, color: "text-rose-600 bg-rose-50 border-rose-200" },
    { label: "Present", value: "Present", icon: CheckCircle2, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { label: "Late Arrival", value: "Late", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { label: "Half Day", value: "Half Day", icon: Clock, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    { label: "Absent", value: "Absent", icon: AlertCircle, color: "text-slate-600 bg-slate-100 border-slate-200" },
    { label: "Leave", value: "Leave", icon: Calendar, color: "text-purple-600 bg-purple-50 border-purple-200" },
    { label: "Outdoor Duty", value: "Outdoor Duty", icon: MapPin, color: "text-teal-600 bg-teal-50 border-teal-200" },
    { label: "Work From Home", value: "Work From Home", icon: Building2, color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
    { label: "Weekly Off", value: "Weekly Off", icon: Calendar, color: "text-slate-500 bg-slate-50 border-slate-200" }
  ];

  const PRESET_LOCATIONS = [
    "Burdwan Office Desk",
    "Raniganj Branch",
    "Salt Lake Sector V Office",
    "Newtown Corporate Hub",
    "Main Reception Biometric",
    "Plant Floor 1 Entry",
    "Warehouse Gate 2",
    "Remote / Client Site"
  ];

  const handleSetCurrentTime = () => {
    const now = new Date();
    setPunchDate(now.toLocaleDateString("en-CA"));
    setPunchTime(now.toLocaleTimeString("en-GB", { hour12: false }));
  };

  const handleSubmitPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedEmployee) {
      setFeedback({ type: "error", message: "Please select an employee for this company." });
      return;
    }

    // Verify employee exists in employee_master for company
    const exists = employees.some(
      emp => emp.company_name === selectedCompany && emp.employee_name.trim().toLowerCase() === selectedEmployee.trim().toLowerCase()
    );
    if (!exists) {
      setFeedback({ type: "error", message: `Employee '${selectedEmployee}' is not registered under '${selectedCompany}'.` });
      return;
    }

    setIsSubmitting(true);

    try {
      // Map simplified status to standard IN / OUT or custom status string
      let dbStatus = punchStatus;
      if (punchStatus === "Check In") dbStatus = "IN";
      else if (punchStatus === "Check Out") dbStatus = "OUT";

      const fullTimestamp = `${punchDate} ${punchTime}`;

      const saved = await insertAttendanceLog({
        company: selectedCompany,
        employee: selectedEmployee,
        timestamp: fullTimestamp,
        status: dbStatus,
        location: punchLocation || "Office Desk"
      });

      logAuditEvent({
        user: currentUser?.username || "Admin",
        role: currentUser?.role || "Administrator",
        action: "Attendance Recorded",
        module: "Attendance Entry",
        company: selectedCompany,
        recordIdentifier: saved.compositeId || `${selectedCompany}-${Date.now()}`,
        newValue: `${selectedEmployee} | ${dbStatus} | ${fullTimestamp} | ${punchLocation}`,
        reason: "Manual attendance punch entry"
      });

      setRecentEntries(prev => [saved, ...prev].slice(0, 5));
      setFeedback({
        type: "success",
        message: `Successfully logged punch for ${selectedEmployee} (${selectedCompany}) into Supabase table '${selectedCompany}'.`
      });

      await onRefreshLogs();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to save punch record to Supabase." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-5xl mx-auto">
      {/* Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <Clock className="w-7 h-7 text-blue-600" />
            <span>Attendance Entry Form</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Directly route and commit punches to origin company tables in Indian Standard Time
          </p>
        </div>

        <button
          onClick={handleSetCurrentTime}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Sync Real Time</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-3 animate-fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <div className="flex-1">{feedback.message}</div>
        </div>
      )}

      {/* Main Entry Form Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmitPunch} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Target Company
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value as CompanyName)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition cursor-pointer"
                >
                  {VALID_COMPANIES.map(co => (
                    <option key={co} value={co}>
                      {co}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Table Routing Indicator */}
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span>Supabase Destination Table:</span>
                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {selectedCompany}
                </span>
              </div>
            </div>

            {/* Employee Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Employee Name ({companyEmployees.length} Enrolled)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  disabled={companyEmployees.length === 0}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition cursor-pointer"
                >
                  {companyEmployees.length > 0 ? (
                    companyEmployees.map(emp => (
                      <option key={emp.id} value={emp.employee_name}>
                        {emp.employee_name}
                      </option>
                    ))
                  ) : (
                    <option value="">No employees found for this company</option>
                  )}
                </select>
              </div>
            </div>

            {/* Attendance Date */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Attendance Date (IST)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={punchDate}
                  onChange={(e) => setPunchDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                />
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                Formatted: {formatToIndianDate(punchDate)}
              </span>
            </div>

            {/* Attendance Time */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Punch Time (24h format: HH:mm:ss)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="time"
                  step="1"
                  required
                  value={punchTime}
                  onChange={(e) => setPunchTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                />
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                12-Hour Display: {formatToIndianTime(punchTime)}
              </span>
            </div>
          </div>

          {/* Status Selection Buttons */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Punch Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {STATUS_OPTIONS.map(opt => {
                const isSelected = punchStatus === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPunchStatus(opt.value)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : `${opt.color} hover:opacity-90`
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location Input & Presets */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Punch Location / Terminal
            </label>
            <div className="relative mb-2">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={punchLocation}
                onChange={(e) => setPunchLocation(e.target.value)}
                placeholder="e.g. Burdwan Office Desk, Raniganj Gate 1"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
              />
            </div>

            {/* Quick Location Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Presets:</span>
              {PRESET_LOCATIONS.slice(0, 5).map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setPunchLocation(loc)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[10px] font-semibold transition cursor-pointer"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-400 font-medium">
              Database Timezone: <strong className="text-slate-700 font-mono">Asia/Kolkata (IST)</strong>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedEmployee}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Committing to Supabase...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Save Attendance Punch</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* RECENT PUNCHES TABLE (IN CURRENT SESSION) */}
      {recentEntries.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Recently Recorded in this Session</span>
            <span className="text-[10px] text-slate-400 font-mono">{recentEntries.length} Punches</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
              {recentEntries.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="p-3 pl-6 font-mono text-[11px] text-slate-400">
                    {log.compositeId || `#${idx + 1}`}
                  </td>
                  <td className="p-3">
                    <span
                      className="px-2 py-0.5 rounded text-[9px] font-extrabold text-white uppercase tracking-wider"
                      style={{ backgroundColor: COMPANY_COLORS[log.company]?.hex || "#475569" }}
                    >
                      {log.company}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-900">{log.employee}</td>
                  <td className="p-3 font-mono text-emerald-700">{formatToIndianDateTime(log.timestamp)}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-black text-[9px]">
                      {log.status}
                    </span>
                  </td>
                  <td className="p-3 pr-6 text-slate-500 text-xs">{log.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
