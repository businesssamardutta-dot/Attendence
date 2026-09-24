import React, { useState, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Building2,
  User,
  Download,
  Printer,
  X
} from "lucide-react";
import { AttendanceLog, CompanyName, Employee, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import {
  extractDateKey,
  extractTime24,
  formatToIndianDate,
  formatToIndianTime,
  calculateWorkingDuration,
  isLateArrival,
  getDayOfWeek
} from "../lib/dateUtils";
import { exportToCSV, exportToExcel, exportToPDF, triggerPrintReport } from "../lib/exportUtils";

interface AttendanceCalendarViewProps {
  employees: Employee[];
  logs: AttendanceLog[];
  selectedGlobalCompany: string;
  currentUser: UserProfile | null;
}

export default function AttendanceCalendarView({
  employees,
  logs,
  selectedGlobalCompany,
  currentUser
}: AttendanceCalendarViewProps) {
  const [selectedCompany, setSelectedCompany] = useState<CompanyName>(
    selectedGlobalCompany && VALID_COMPANIES.includes(selectedGlobalCompany as CompanyName)
      ? (selectedGlobalCompany as CompanyName)
      : "HB"
  );

  // Available employees for selected company
  const companyEmployees = useMemo(() => {
    return employees.filter(e => e.company_name === selectedCompany);
  }, [employees, selectedCompany]);

  const [selectedEmployee, setSelectedEmployee] = useState<string>(
    currentUser?.role === "Employee" && currentUser.employeeName
      ? currentUser.employeeName
      : "Sneha Mojumder"
  );

  // Determine current month or default to latest log month (e.g. June 2026 or current)
  const defaultMonth = useMemo(() => {
    if (logs.length > 0) {
      const dates = logs.map(l => extractDateKey(l.timestamp)).filter(Boolean);
      dates.sort((a, b) => b.localeCompare(a));
      if (dates[0]) {
        return dates[0].substring(0, 7); // YYYY-MM
      }
    }
    return "2026-06";
  }, [logs]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedDayDetails, setSelectedDayDetails] = useState<any | null>(null);

  // Sync employee dropdown when company changes
  React.useEffect(() => {
    if (currentUser?.role === "Employee" && currentUser.employeeName) {
      setSelectedEmployee(currentUser.employeeName);
    } else if (companyEmployees.length > 0 && !companyEmployees.some(e => e.employee_name === selectedEmployee)) {
      setSelectedEmployee(companyEmployees[0].employee_name);
    }
  }, [selectedCompany, companyEmployees, currentUser, selectedEmployee]);

  // Generate calendar days for selected month (1st to 28/30/31st)
  const monthData = useMemo(() => {
    if (!selectedMonth || !selectedEmployee) return { days: [], summary: {} };

    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1 to 12

    const daysInMonth = new Date(year, month, 0).getDate();

    // Filter logs for this employee & company in this month
    const empLogs = logs.filter(
      l =>
        l.company === selectedCompany &&
        l.employee.trim().toLowerCase() === selectedEmployee.trim().toLowerCase() &&
        extractDateKey(l.timestamp).startsWith(selectedMonth)
    );

    let presentDays = 0;
    let lateDays = 0;
    let missingPunchDays = 0;
    let totalMinutes = 0;

    const daysList: any[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayFormatted = String(d).padStart(2, "0");
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${dayFormatted}`;
      const dayOfWeek = getDayOfWeek(dateKey);
      const isSunday = dayOfWeek === "Sunday";

      // Find punches for this day
      const dayPunches = empLogs.filter(l => extractDateKey(l.timestamp) === dateKey);

      const ins = dayPunches.filter(p => (p.status || "").toUpperCase() === "IN" || (p.status || "").toLowerCase() === "check in");
      const outs = dayPunches.filter(p => (p.status || "").toUpperCase() === "OUT" || (p.status || "").toLowerCase() === "check out");

      ins.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
      outs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

      const firstIn = ins[0];
      const lastOut = outs[0];

      let status = "Absent";
      let statusColor = "bg-rose-50 border-rose-200 text-rose-700";
      let durationText = "—";

      if (isSunday) {
        status = "Weekly Off";
        statusColor = "bg-slate-100 border-slate-200 text-slate-500";
      }

      if (firstIn && lastOut) {
        const inTime24 = extractTime24(firstIn.timestamp);
        const outTime24 = extractTime24(lastOut.timestamp);
        const dur = calculateWorkingDuration(inTime24, outTime24);
        durationText = dur.text;
        totalMinutes += dur.minutes;

        if (isLateArrival(inTime24)) {
          status = "Late";
          statusColor = "bg-amber-50 border-amber-200 text-amber-800";
          lateDays++;
          presentDays++;
        } else {
          status = "Present";
          statusColor = "bg-emerald-50 border-emerald-200 text-emerald-800";
          presentDays++;
        }
      } else if (firstIn && !lastOut) {
        const inTime24 = extractTime24(firstIn.timestamp);
        if (isLateArrival(inTime24)) lateDays++;
        status = "Missing Punch";
        statusColor = "bg-yellow-50 border-yellow-200 text-yellow-800";
        missingPunchDays++;
        presentDays++;
      } else if (!firstIn && lastOut) {
        status = "Missing Punch";
        statusColor = "bg-yellow-50 border-yellow-200 text-yellow-800";
        missingPunchDays++;
        presentDays++;
      }

      daysList.push({
        dayNumber: d,
        dateKey,
        formattedDate: `${dayFormatted}-${String(month).padStart(2, "0")}-${year}`,
        dayOfWeek,
        isSunday,
        status,
        statusColor,
        firstIn: firstIn ? formatToIndianTime(firstIn.timestamp) : "—",
        firstInLocation: firstIn?.location || "—",
        lastOut: lastOut ? formatToIndianTime(lastOut.timestamp) : "—",
        lastOutLocation: lastOut?.location || "—",
        durationText,
        punchesCount: dayPunches.length,
        dayPunches
      });
    }

    const absentDays = Math.max(0, daysInMonth - presentDays - daysList.filter(d => d.isSunday).length);
    const totalHoursStr = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

    return {
      days: daysList,
      summary: {
        daysInMonth,
        presentDays,
        lateDays,
        missingPunchDays,
        absentDays,
        totalHoursStr
      }
    };
  }, [selectedMonth, selectedCompany, selectedEmployee, logs]);

  // Export handlers
  const handleExport = (type: "excel" | "csv" | "pdf" | "print") => {
    const headers = ["Date", "Day", "Status", "First Punch IN", "Punch IN Location", "Last Punch OUT", "Punch OUT Location", "Work Duration"];
    const rows = (monthData.days || []).map(d => [
      d.formattedDate,
      d.dayOfWeek,
      d.status,
      d.firstIn,
      d.firstInLocation,
      d.lastOut,
      d.lastOutLocation,
      d.durationText
    ]);

    const opts = {
      title: `Monthly Attendance Calendar: ${selectedEmployee} (${selectedCompany})`,
      filename: `Timesheet_${selectedCompany}_${selectedEmployee.replace(/\s+/g, "_")}_${selectedMonth}`,
      headers,
      rows,
      metaInfo: {
        Employee: selectedEmployee,
        Company: selectedCompany,
        Month: selectedMonth,
        "Present Days": String(monthData.summary?.presentDays || 0),
        "Total Hours": monthData.summary?.totalHoursStr || "0h"
      }
    };

    if (type === "excel") exportToExcel(opts);
    else if (type === "csv") exportToCSV(opts);
    else if (type === "pdf") exportToPDF(opts);
    else if (type === "print") triggerPrintReport(opts);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7 text-blue-600" />
            <span>Monthly Attendance Calendar</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Individual date-wise roster tracking with shift calculations and punch details
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
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
          <button
            onClick={() => handleExport("print")}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Company Dropdown */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Company Entity
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value as CompanyName)}
              disabled={currentUser?.role === "Employee"}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
            >
              {VALID_COMPANIES.map(co => (
                <option key={co} value={co}>
                  {co}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Employee Dropdown */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Selected Employee
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              disabled={currentUser?.role === "Employee"}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
            >
              {companyEmployees.map(emp => (
                <option key={emp.id} value={emp.employee_name}>
                  {emp.employee_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Month Picker */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Timesheet Month
          </label>
          <div className="relative">
            <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Monthly Summary Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Present Days</span>
          <div className="text-2xl font-black text-emerald-600 font-display mt-1">
            {monthData.summary?.presentDays || 0}
          </div>
          <span className="text-[10px] text-slate-400">Total days clocked in</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Late Marks</span>
          <div className="text-2xl font-black text-amber-600 font-display mt-1">
            {monthData.summary?.lateDays || 0}
          </div>
          <span className="text-[10px] text-amber-600">Arrivals after 09:30 AM</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider block">Missing Punches</span>
          <div className="text-2xl font-black text-yellow-700 font-display mt-1">
            {monthData.summary?.missingPunchDays || 0}
          </div>
          <span className="text-[10px] text-slate-400">Single punch recorded</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Absent Days</span>
          <div className="text-2xl font-black text-rose-600 font-display mt-1">
            {monthData.summary?.absentDays || 0}
          </div>
          <span className="text-[10px] text-slate-400">No punch on working days</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Total Work Hours</span>
          <div className="text-2xl font-black text-blue-600 font-display mt-1">
            {monthData.summary?.totalHoursStr || "0h 0m"}
          </div>
          <span className="text-[10px] text-slate-400">Recorded logged duration</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-slate-900 text-base font-display">
            Timesheet Calendar: {selectedEmployee}
          </h3>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Present</span>
            <span className="flex items-center gap-1 text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500" /> Late</span>
            <span className="flex items-center gap-1 text-yellow-800"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Missing</span>
            <span className="flex items-center gap-1 text-rose-700"><span className="w-2 h-2 rounded-full bg-rose-500" /> Absent</span>
            <span className="flex items-center gap-1 text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-400" /> Off</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {monthData.days.map((day) => (
            <div
              key={day.dateKey}
              onClick={() => setSelectedDayDetails(day)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] flex flex-col justify-between ${day.statusColor}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm font-mono">{day.dayNumber}</span>
                <span className="text-[10px] font-bold uppercase">{day.dayOfWeek.substring(0, 3)}</span>
              </div>

              <div className="my-2 space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider block">
                  {day.status}
                </span>

                {day.firstIn !== "—" && (
                  <div className="text-[10px] font-mono leading-tight">
                    <span className="font-bold text-slate-900">IN:</span> {day.firstIn}
                  </div>
                )}
                {day.lastOut !== "—" && (
                  <div className="text-[10px] font-mono leading-tight">
                    <span className="font-bold text-slate-900">OUT:</span> {day.lastOut}
                  </div>
                )}
              </div>

              <div className="text-[10px] font-mono font-bold text-slate-700 border-t border-black/5 pt-1">
                {day.durationText !== "—" ? day.durationText : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DAY BREAKDOWN MODAL */}
      {selectedDayDetails && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-left">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Day Attendance Breakdown</span>
                <h3 className="font-extrabold text-lg font-display text-white">
                  {selectedDayDetails.formattedDate} ({selectedDayDetails.dayOfWeek})
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedEmployee} • <span className="font-bold text-blue-400">{selectedCompany}</span>
                </p>
              </div>
              <button onClick={() => setSelectedDayDetails(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">First Punch IN</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{selectedDayDetails.firstIn}</span>
                  <p className="text-slate-500 text-[11px] truncate">{selectedDayDetails.firstInLocation}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Punch OUT</span>
                  <span className="font-mono font-bold text-rose-700 text-sm">{selectedDayDetails.lastOut}</span>
                  <p className="text-slate-500 text-[11px] truncate">{selectedDayDetails.lastOutLocation}</p>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  All Punches Recorded ({selectedDayDetails.dayPunches?.length || 0})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {selectedDayDetails.dayPunches && selectedDayDetails.dayPunches.length > 0 ? (
                    selectedDayDetails.dayPunches.map((punch: AttendanceLog, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{formatToIndianTime(punch.timestamp)}</span>
                          <span className="px-2 py-0.5 rounded font-black text-[9px] bg-blue-100 text-blue-800 uppercase">
                            {punch.status}
                          </span>
                        </div>
                        <span className="text-slate-500 truncate max-w-[180px]">{punch.location}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-400 text-xs font-medium">
                      No physical biometric punches logged for this date.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDayDetails(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
