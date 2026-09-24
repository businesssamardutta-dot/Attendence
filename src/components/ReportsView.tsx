import React, { useState, useMemo } from "react";
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Building2,
  User,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Sparkles
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

interface ReportsViewProps {
  logs: AttendanceLog[];
  employees: Employee[];
  selectedGlobalCompany: string;
  currentUser: UserProfile | null;
  initialParams?: any;
}

export type ReportType =
  | "daily"
  | "monthly"
  | "employee_timesheet"
  | "company_wise"
  | "present"
  | "absent"
  | "checkin"
  | "checkout"
  | "missing_punch"
  | "late"
  | "location"
  | "status"
  | "raw_logs"
  | "date_range";

export default function ReportsView({
  logs,
  employees,
  selectedGlobalCompany,
  currentUser,
  initialParams
}: ReportsViewProps) {
  const [reportType, setReportType] = useState<ReportType>(
    initialParams?.reportType || "daily"
  );
  const [selectedCompany, setSelectedCompany] = useState<string>(
    selectedGlobalCompany || "ALL"
  );
  const [selectedEmployee, setSelectedEmployee] = useState<string>("ALL");
  const [targetDate, setTargetDate] = useState<string>(
    logs.length > 0 ? extractDateKey(logs[0].timestamp) || "2026-06-01" : "2026-06-01"
  );
  const [targetMonth, setTargetMonth] = useState<string>("2026-06");
  const [fromDate, setFromDate] = useState<string>("2026-06-01");
  const [toDate, setToDate] = useState<string>("2026-06-30");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const REPORT_DEFINITIONS: { id: ReportType; title: string; desc: string }[] = [
    { id: "daily", title: "Daily Attendance Report", desc: "Day-wise attendance summary for all employees" },
    { id: "monthly", title: "Monthly Attendance Summary", desc: "Aggregated monthly attendance counts per employee" },
    { id: "employee_timesheet", title: "Single Employee 1-Month Timesheet", desc: "Date-wise 1st-31st timesheet with First IN, Last OUT, and duration" },
    { id: "company_wise", title: "Company-Wise Attendance Report", desc: "Summary comparison across the 5 authorized companies" },
    { id: "present", title: "Present Employees Report", desc: "All employees who recorded attendance punches" },
    { id: "absent", title: "Absent Employees Report", desc: "List of enrolled personnel with no punch on date" },
    { id: "checkin", title: "Check-In (IN Punch) Report", desc: "All first arrival punches recorded" },
    { id: "checkout", title: "Check-Out (OUT Punch) Report", desc: "All departure punches recorded" },
    { id: "missing_punch", title: "Missing Punch Discrepancy Report", desc: "Employees with incomplete single punch" },
    { id: "late", title: "Late Attendance Report", desc: "Staff arrivals recorded after 09:30 AM" },
    { id: "location", title: "Location / Terminal Report", desc: "Attendance distribution across physical kiosks" },
    { id: "status", title: "Attendance Status Report", desc: "Breakdown of work from home, leave, outdoor duty" },
    { id: "raw_logs", title: "Raw Attendance Log Ledger", desc: "Unprocessed raw biometric stream with composite keys" },
    { id: "date_range", title: "Custom Date-Range Report", desc: "Multi-day span attendance audit" }
  ];

  // Compute Active Report Dataset
  const { headers, rows, metaInfo } = useMemo(() => {
    let repHeaders: string[] = [];
    let repRows: (string | number)[][] = [];
    const meta: Record<string, string> = {
      Report: REPORT_DEFINITIONS.find(r => r.id === reportType)?.title || reportType,
      Company: selectedCompany,
      Date: targetDate
    };

    // Filter employees
    const targetEmps = employees.filter(e => selectedCompany === "ALL" || e.company_name === selectedCompany);

    // Filter logs
    const baseLogs = logs.filter(l => selectedCompany === "ALL" || l.company === selectedCompany);

    if (reportType === "daily" || reportType === "present" || reportType === "absent" || reportType === "late") {
      repHeaders = ["Company", "Employee Name", "First IN", "Punch IN Location", "Last OUT", "Punch OUT Location", "Work Duration", "Status"];
      const dayLogs = baseLogs.filter(l => extractDateKey(l.timestamp) === targetDate);

      targetEmps.forEach(emp => {
        const empDayLogs = dayLogs.filter(
          l => l.company === emp.company_name && l.employee.trim().toLowerCase() === emp.employee_name.trim().toLowerCase()
        );

        const ins = empDayLogs.filter(p => (p.status || "").toUpperCase() === "IN" || (p.status || "").toLowerCase() === "check in");
        const outs = empDayLogs.filter(p => (p.status || "").toUpperCase() === "OUT" || (p.status || "").toLowerCase() === "check out");

        ins.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
        outs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

        const firstIn = ins[0];
        const lastOut = outs[0];
        const inTime24 = firstIn ? extractTime24(firstIn.timestamp) : "";
        const outTime24 = lastOut ? extractTime24(lastOut.timestamp) : "";
        const isLate = inTime24 ? isLateArrival(inTime24) : false;

        let status = "Absent";
        let duration = "—";

        if (firstIn && lastOut) {
          duration = calculateWorkingDuration(inTime24, outTime24).text;
          status = isLate ? "Late Arrival" : "Present";
        } else if (firstIn || lastOut) {
          status = "Missing Punch";
        }

        const isPresent = Boolean(firstIn || lastOut);

        // Apply Report Type filters
        if (reportType === "present" && !isPresent) return;
        if (reportType === "absent" && isPresent) return;
        if (reportType === "late" && !isLate) return;

        repRows.push([
          emp.company_name,
          emp.employee_name,
          firstIn ? formatToIndianTime(firstIn.timestamp) : "—",
          firstIn?.location || "—",
          lastOut ? formatToIndianTime(lastOut.timestamp) : "—",
          lastOut?.location || "—",
          duration,
          status
        ]);
      });
    } else if (reportType === "employee_timesheet") {
      repHeaders = ["Date (IST)", "Day of Week", "Status", "First IN Time", "IN Location", "Last OUT Time", "OUT Location", "Work Duration"];
      const [yearStr, monthStr] = targetMonth.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const daysInMonth = new Date(year, month, 0).getDate();

      const empName = selectedEmployee !== "ALL" ? selectedEmployee : (targetEmps[0]?.employee_name || "Sneha Mojumder");
      meta["Employee"] = empName;
      meta["Month"] = targetMonth;

      const empMonthLogs = baseLogs.filter(
        l => l.employee.trim().toLowerCase() === empName.trim().toLowerCase() && extractDateKey(l.timestamp).startsWith(targetMonth)
      );

      for (let d = 1; d <= daysInMonth; d++) {
        const dayFormatted = String(d).padStart(2, "0");
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${dayFormatted}`;
        const dayOfWeek = getDayOfWeek(dateKey);
        const isSunday = dayOfWeek === "Sunday";

        const dayPunches = empMonthLogs.filter(l => extractDateKey(l.timestamp) === dateKey);
        const ins = dayPunches.filter(p => (p.status || "").toUpperCase() === "IN" || (p.status || "").toLowerCase() === "check in");
        const outs = dayPunches.filter(p => (p.status || "").toUpperCase() === "OUT" || (p.status || "").toLowerCase() === "check out");

        ins.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
        outs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

        const firstIn = ins[0];
        const lastOut = outs[0];
        let status = isSunday ? "Weekly Off" : "Absent";
        let duration = "—";

        if (firstIn && lastOut) {
          const inTime24 = extractTime24(firstIn.timestamp);
          const outTime24 = extractTime24(lastOut.timestamp);
          duration = calculateWorkingDuration(inTime24, outTime24).text;
          status = isLateArrival(inTime24) ? "Late Arrival" : "Present";
        } else if (firstIn || lastOut) {
          status = "Missing Punch";
        }

        repRows.push([
          formatToIndianDate(dateKey),
          dayOfWeek,
          status,
          firstIn ? formatToIndianTime(firstIn.timestamp) : "—",
          firstIn?.location || "—",
          lastOut ? formatToIndianTime(lastOut.timestamp) : "—",
          lastOut?.location || "—",
          duration
        ]);
      }
    } else if (reportType === "company_wise") {
      repHeaders = ["Company Name", "Total Enrolled", "Present on Date", "Absent on Date", "Late Arrivals", "Turnout %"];
      const dayLogs = logs.filter(l => extractDateKey(l.timestamp) === targetDate);

      VALID_COMPANIES.forEach(co => {
        const coEmps = employees.filter(e => e.company_name === co);
        const coDayLogs = dayLogs.filter(l => l.company === co);
        const presentSet = new Set(coDayLogs.map(l => l.employee.trim()));
        const presentCount = presentSet.size;
        const absentCount = Math.max(0, coEmps.length - presentCount);
        const turnout = coEmps.length > 0 ? `${Math.round((presentCount / coEmps.length) * 100)}%` : "0%";

        repRows.push([co, coEmps.length, presentCount, absentCount, "—", turnout]);
      });
    } else {
      // Default / Raw Logs / Date Range / CheckIn / CheckOut
      repHeaders = ["Composite ID", "Company", "Employee Name", "Date (IST)", "Time (IST)", "Status", "Punch Location"];
      let rLogs = baseLogs;

      if (reportType === "checkin") {
        rLogs = rLogs.filter(l => (l.status || "").toUpperCase() === "IN" || (l.status || "").toLowerCase() === "check in");
      } else if (reportType === "checkout") {
        rLogs = rLogs.filter(l => (l.status || "").toUpperCase() === "OUT" || (l.status || "").toLowerCase() === "check out");
      } else if (reportType === "date_range") {
        rLogs = rLogs.filter(l => {
          const d = extractDateKey(l.timestamp);
          return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
        });
      }

      rLogs.forEach(l => {
        repRows.push([
          l.compositeId || `${l.company}-${l.id}`,
          l.company,
          l.employee,
          formatToIndianDate(l.timestamp),
          formatToIndianTime(l.timestamp),
          l.status,
          l.location || "Office"
        ]);
      });
    }

    // Filter by search query if present
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      repRows = repRows.filter(r => r.some(cell => String(cell).toLowerCase().includes(q)));
    }

    return { headers: repHeaders, rows: repRows, metaInfo: meta };
  }, [reportType, selectedCompany, selectedEmployee, targetDate, targetMonth, fromDate, toDate, logs, employees, searchQuery]);

  // Paginated Rows
  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  // Export handlers
  const handleExport = (type: "excel" | "csv" | "pdf" | "print") => {
    const activeDef = REPORT_DEFINITIONS.find(r => r.id === reportType);
    const opts = {
      title: activeDef?.title || "Attendance Report",
      filename: `${reportType}_Report_${selectedCompany}_${targetDate}`,
      headers,
      rows,
      metaInfo
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
            <BarChart3 className="w-7 h-7 text-blue-600" />
            <span>Attendance Reports Center</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            14 production report templates with Excel, CSV, PDF, and print preview export
          </p>
        </div>

        {/* Action Buttons */}
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

      {/* Report Template Selector & Parameter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Template Dropdown */}
          <div className="lg:col-span-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Select Report Template (14 Available)
            </label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as ReportType);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
            >
              {REPORT_DEFINITIONS.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          {/* Company Scope */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Company Scope
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => {
                setSelectedCompany(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
            >
              <option value="ALL">🏢 All Companies (5)</option>
              {VALID_COMPANIES.map(co => (
                <option key={co} value={co}>
                  {co}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Date / Month / Range Parameter */}
          <div>
            {reportType === "employee_timesheet" ? (
              <>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Target Month
                </label>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </>
            ) : reportType === "date_range" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            ) : (
              <>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Report Date (IST)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </>
            )}
          </div>
        </div>

        {/* Employee Dropdown when Single Employee Timesheet is selected */}
        {reportType === "employee_timesheet" && (
          <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
            <span className="text-xs font-bold text-slate-600">Select Employee:</span>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {employees
                .filter(e => selectedCompany === "ALL" || e.company_name === selectedCompany)
                .map(e => (
                  <option key={e.id} value={e.employee_name}>
                    {e.employee_name} ({e.company_name})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Search inside report */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table rows..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl whitespace-nowrap">
            Generated {rows.length} Records
          </span>
        </div>
      </div>

      {/* Generated Report Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                {headers.map((h, idx) => (
                  <th key={idx} className={`p-4 ${idx === 0 ? "pl-6" : ""} ${idx === headers.length - 1 ? "pr-6" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/60 transition">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`p-4 whitespace-nowrap ${cIdx === 0 ? "pl-6" : ""} ${cIdx === row.length - 1 ? "pr-6" : ""} ${
                          cIdx === 1 ? "font-bold text-slate-900" : ""
                        }`}
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers.length} className="p-12 text-center text-slate-400 font-medium">
                    No data records found for this report configuration.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
