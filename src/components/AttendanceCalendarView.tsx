import React, { useState, useMemo, useEffect } from "react";
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
  X,
  Search
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

  // Sync when global company changes in navbar
  useEffect(() => {
    if (selectedGlobalCompany && VALID_COMPANIES.includes(selectedGlobalCompany as CompanyName)) {
      setSelectedCompany(selectedGlobalCompany as CompanyName);
    }
  }, [selectedGlobalCompany]);

  // Available employees for selected company (combining employee_master + any active in logs)
  const companyEmployees = useMemo(() => {
    const list: Employee[] = employees.filter(e => e.company_name === selectedCompany);
    const logEmps = Array.from(new Set(logs.filter(l => l.company === selectedCompany).map(l => l.employee.trim())));
    logEmps.forEach(empName => {
      if (!list.some(e => e.employee_name.trim().toLowerCase() === empName.toLowerCase())) {
        list.push({ id: 0, company_name: selectedCompany, employee_name: empName });
      }
    });
    return list.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  }, [employees, logs, selectedCompany]);

  const [selectedEmployee, setSelectedEmployee] = useState<string>(() => {
    if (currentUser?.role === "Employee" && currentUser.employeeName) {
      return currentUser.employeeName;
    }
    return companyEmployees[0]?.employee_name || "Sneha Mojumder";
  });

  // Determine default month from available logs or current month
  const defaultMonth = useMemo(() => {
    if (logs.length > 0) {
      const dates = logs.map(l => extractDateKey(l.timestamp)).filter(Boolean);
      dates.sort((a, b) => b.localeCompare(a));
      if (dates[0]) {
        return dates[0].substring(0, 7); // YYYY-MM
      }
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [logs]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedDayDetails, setSelectedDayDetails] = useState<any | null>(null);

  // Sync employee dropdown when company changes
  useEffect(() => {
    if (currentUser?.role === "Employee" && currentUser.employeeName) {
      setSelectedEmployee(currentUser.employeeName);
    } else if (companyEmployees.length > 0 && !companyEmployees.some(e => e.employee_name.toLowerCase() === selectedEmployee.toLowerCase())) {
      setSelectedEmployee(companyEmployees[0].employee_name);
    }
  }, [selectedCompany, companyEmployees, currentUser, selectedEmployee]);

  // Generate calendar days for selected month (1st to 28/30/31st)
  const monthData = useMemo(() => {
    if (!selectedMonth || !selectedEmployee) return { days: [], summary: {} };

    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10) || 2026;
    const month = parseInt(monthStr, 10) || 6; // 1 to 12

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
          status = "Late Arrival";
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
    const headers = ["Date (IST)", "Day", "Status", "First Punch IN", "Punch IN Location", "Last Punch OUT", "Punch OUT Location", "Work Duration"];
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
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            onClick={() => handleExport("csv")}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => handleExport("print")}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Control Filters Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Company Dropdown */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Company
          </label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value as CompanyName)}
            disabled={currentUser?.role === "Employee"}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer disabled:opacity-60"
          >
            {VALID_COMPANIES.map(co => (
              <option key={co} value={co}>
                {co}
              </option>
            ))}
          </select>
        </div>

        {/* Employee Dropdown */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Employee ({companyEmployees.length} Available)
          </label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            disabled={currentUser?.role === "Employee"}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer disabled:opacity-60"
          >
            {companyEmployees.map(emp => (
              <option key={`${emp.company_name}-${emp.employee_name}`} value={emp.employee_name}>
                {emp.employee_name}
              </option>
            ))}
          </select>
        </div>

        {/* Month Selector */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Timesheet Month (YYYY-MM)
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Month Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Month Days</span>
          <p className="text-lg font-black font-display text-slate-900 mt-0.5">{monthData.summary?.daysInMonth || 0}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Present Days</span>
          <p className="text-lg font-black font-display text-emerald-700 mt-0.5">{monthData.summary?.presentDays || 0}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Late Arrivals</span>
          <p className="text-lg font-black font-display text-amber-700 mt-0.5">{monthData.summary?.lateDays || 0}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-yellow-200/80 bg-yellow-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider block">Missing Punches</span>
          <p className="text-lg font-black font-display text-yellow-700 mt-0.5">{monthData.summary?.missingPunchDays || 0}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Absent Days</span>
          <p className="text-lg font-black font-display text-rose-700 mt-0.5">{monthData.summary?.absentDays || 0}</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Hours Worked</span>
          <p className="text-lg font-black font-display text-blue-700 mt-0.5">{monthData.summary?.totalHoursStr || "0h 0m"}</p>
        </div>
      </div>

      {/* Calendar Grid (Days 1 to 31) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Daily Attendance Matrix ({selectedMonth})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {monthData.days.map((day) => (
            <div
              key={day.dateKey}
              onClick={() => setSelectedDayDetails(day)}
              className={`p-3 rounded-2xl border transition cursor-pointer hover:shadow-md flex flex-col justify-between min-h-[120px] ${
                day.statusColor
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-display">{day.dayNumber}</span>
                  <span className="text-[10px] font-bold opacity-75">{day.dayOfWeek.substring(0, 3)}</span>
                </div>

                <div className="mt-2 text-[10px] font-extrabold uppercase tracking-wide">
                  {day.status}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-black/5 text-[9px] font-medium space-y-0.5">
                {day.firstIn !== "—" && (
                  <div className="flex items-center justify-between">
                    <span className="opacity-75">IN:</span>
                    <span className="font-bold">{day.firstIn}</span>
                  </div>
                )}
                {day.lastOut !== "—" && (
                  <div className="flex items-center justify-between">
                    <span className="opacity-75">OUT:</span>
                    <span className="font-bold">{day.lastOut}</span>
                  </div>
                )}
                {day.durationText !== "—" && (
                  <div className="flex items-center justify-between text-blue-800 font-bold">
                    <span>Dur:</span>
                    <span>{day.durationText}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDayDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black font-display text-slate-900">
                  {selectedDayDetails.formattedDate} ({selectedDayDetails.dayOfWeek})
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {selectedEmployee} • {selectedCompany}
                </p>
              </div>
              <button
                onClick={() => setSelectedDayDetails(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold">Daily Status:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${selectedDayDetails.statusColor}`}>
                  {selectedDayDetails.status}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold">First IN Punch:</span>
                <span className="font-bold text-slate-900">{selectedDayDetails.firstIn}</span>
              </div>

              {selectedDayDetails.firstInLocation !== "—" && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-bold block mb-0.5">IN Location:</span>
                  <span className="text-slate-800 text-[11px] font-medium">{selectedDayDetails.firstInLocation}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold">Last OUT Punch:</span>
                <span className="font-bold text-slate-900">{selectedDayDetails.lastOut}</span>
              </div>

              {selectedDayDetails.lastOutLocation !== "—" && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-bold block mb-0.5">OUT Location:</span>
                  <span className="text-slate-800 text-[11px] font-medium">{selectedDayDetails.lastOutLocation}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50 border border-blue-200">
                <span className="text-blue-700 font-bold">Total Work Duration:</span>
                <span className="font-extrabold text-blue-900">{selectedDayDetails.durationText}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedDayDetails(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
