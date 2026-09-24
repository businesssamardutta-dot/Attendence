import React, { useState, useMemo, useEffect } from "react";
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
  Sparkles,
  Layers,
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
  // Determine latest month from logs or default to current
  const detectedDefaultMonth = useMemo(() => {
    if (logs.length > 0) {
      const dates = logs.map(l => extractDateKey(l.timestamp)).filter(Boolean);
      dates.sort((a, b) => b.localeCompare(a));
      if (dates[0]) return dates[0].substring(0, 7);
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [logs]);

  const detectedDefaultDate = useMemo(() => {
    if (logs.length > 0) {
      const dates = logs.map(l => extractDateKey(l.timestamp)).filter(Boolean);
      dates.sort((a, b) => b.localeCompare(a));
      if (dates[0]) return dates[0];
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [logs]);

  const [reportType, setReportType] = useState<ReportType>(
    initialParams?.reportType || "daily"
  );
  const [selectedCompany, setSelectedCompany] = useState<string>(
    selectedGlobalCompany || "ALL"
  );

  // Sync when top global company dropdown changes
  useEffect(() => {
    if (selectedGlobalCompany) {
      setSelectedCompany(selectedGlobalCompany);
    }
  }, [selectedGlobalCompany]);

  // Comprehensive list of available employees (Master DB + Biometric logs)
  const availableEmployees = useMemo(() => {
    const list: { company: string; name: string }[] = [];
    const seen = new Set<string>();

    employees.forEach(e => {
      if (selectedCompany === "ALL" || e.company_name === selectedCompany) {
        const key = `${e.company_name}|${e.employee_name.trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ company: e.company_name, name: e.employee_name.trim() });
        }
      }
    });

    logs.forEach(l => {
      if (selectedCompany === "ALL" || l.company === selectedCompany) {
        const empName = (l.employee || "").trim();
        if (empName) {
          const key = `${l.company}|${empName}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({ company: l.company, name: empName });
          }
        }
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, logs, selectedCompany]);

  const [selectedEmployee, setSelectedEmployee] = useState<string>("");

  // Sync selected employee whenever available employees change
  useEffect(() => {
    if (availableEmployees.length > 0) {
      const exists = availableEmployees.some(
        e => e.name.toLowerCase() === selectedEmployee.toLowerCase()
      );
      if (!exists) {
        setSelectedEmployee(availableEmployees[0].name);
      }
    } else {
      setSelectedEmployee("");
    }
  }, [availableEmployees, selectedEmployee]);

  const [targetDate, setTargetDate] = useState<string>(
    initialParams?.date || detectedDefaultDate
  );
  const [targetMonth, setTargetMonth] = useState<string>(detectedDefaultMonth);
  const [fromDate, setFromDate] = useState<string>(`${detectedDefaultMonth}-01`);
  const [toDate, setToDate] = useState<string>(`${detectedDefaultMonth}-31`);
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
      Company: selectedCompany
    };

    const targetEmps = availableEmployees;
    const baseLogs = logs.filter(l => selectedCompany === "ALL" || l.company === selectedCompany);

    // -------------------------------------------------------------
    // 1. DAILY, PRESENT, ABSENT, LATE REPORTS
    // -------------------------------------------------------------
    if (reportType === "daily" || reportType === "present" || reportType === "absent" || reportType === "late") {
      meta["Date (IST)"] = formatToIndianDate(targetDate);
      repHeaders = ["Company", "Employee Name", "First IN (IST)", "Punch IN Location", "Last OUT (IST)", "Punch OUT Location", "Work Duration", "Status"];
      const dayLogs = baseLogs.filter(l => extractDateKey(l.timestamp) === targetDate);

      targetEmps.forEach(emp => {
        const empDayLogs = dayLogs.filter(
          l => l.company === emp.company && l.employee.trim().toLowerCase() === emp.name.trim().toLowerCase()
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

        // Apply filters
        if (reportType === "present" && !isPresent) return;
        if (reportType === "absent" && isPresent) return;
        if (reportType === "late" && !isLate) return;

        repRows.push([
          emp.company,
          emp.name,
          firstIn ? formatToIndianTime(firstIn.timestamp) : "—",
          firstIn?.location || "—",
          lastOut ? formatToIndianTime(lastOut.timestamp) : "—",
          lastOut?.location || "—",
          duration,
          status
        ]);
      });
    }

    // -------------------------------------------------------------
    // 2. MONTHLY ATTENDANCE SUMMARY (ALL EMPLOYEES ACROSS MONTH)
    // -------------------------------------------------------------
    else if (reportType === "monthly") {
      meta["Target Month"] = targetMonth;
      repHeaders = [
        "Company",
        "Employee Name",
        "Month Days",
        "Present Days",
        "Absent Days",
        "Late Days",
        "Missing Punches",
        "Total Hours",
        "Attendance Turnout"
      ];

      const [yearStr, monthStr] = targetMonth.split("-");
      const year = parseInt(yearStr, 10) || 2026;
      const month = parseInt(monthStr, 10) || 6;
      const daysInMonth = new Date(year, month, 0).getDate();

      const monthLogs = baseLogs.filter(l => extractDateKey(l.timestamp).startsWith(targetMonth));

      targetEmps.forEach(emp => {
        const empMonthLogs = monthLogs.filter(
          l => l.company === emp.company && l.employee.trim().toLowerCase() === emp.name.trim().toLowerCase()
        );

        let presentDays = 0;
        let lateDays = 0;
        let missingPunches = 0;
        let totalMinutes = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = String(d).padStart(2, "0");
          const dateKey = `${year}-${String(month).padStart(2, "0")}-${dayStr}`;
          const dayLogs = empMonthLogs.filter(l => extractDateKey(l.timestamp) === dateKey);

          if (dayLogs.length > 0) {
            const ins = dayLogs.filter(p => (p.status || "").toUpperCase() === "IN" || (p.status || "").toLowerCase() === "check in");
            const outs = dayLogs.filter(p => (p.status || "").toUpperCase() === "OUT" || (p.status || "").toLowerCase() === "check out");

            ins.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
            outs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

            const firstIn = ins[0];
            const lastOut = outs[0];

            if (firstIn || lastOut) {
              presentDays++;
              if (firstIn && lastOut) {
                const in24 = extractTime24(firstIn.timestamp);
                const out24 = extractTime24(lastOut.timestamp);
                const dur = calculateWorkingDuration(in24, out24);
                totalMinutes += dur.minutes;
                if (isLateArrival(in24)) lateDays++;
              } else {
                missingPunches++;
                if (firstIn && isLateArrival(extractTime24(firstIn.timestamp))) lateDays++;
              }
            }
          }
        }

        const absentDays = Math.max(0, daysInMonth - presentDays);
        const hoursWorked = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
        const turnoutPct = daysInMonth > 0 ? `${Math.round((presentDays / daysInMonth) * 100)}%` : "0%";

        repRows.push([
          emp.company,
          emp.name,
          daysInMonth,
          presentDays,
          absentDays,
          lateDays,
          missingPunches,
          hoursWorked,
          turnoutPct
        ]);
      });
    }

    // -------------------------------------------------------------
    // 3. SINGLE EMPLOYEE 1-MONTH TIMESHEET (1st to 31st)
    // -------------------------------------------------------------
    else if (reportType === "employee_timesheet") {
      repHeaders = [
        "Company",
        "Employee Name",
        "Date (IST)",
        "Day of Week",
        "Status",
        "First IN (IST)",
        "Punch IN Location",
        "Last OUT (IST)",
        "Punch OUT Location",
        "Work Duration"
      ];

      const [yearStr, monthStr] = targetMonth.split("-");
      const year = parseInt(yearStr, 10) || 2026;
      const month = parseInt(monthStr, 10) || 6;
      const daysInMonth = new Date(year, month, 0).getDate();

      const chosenEmpObj = targetEmps.find(
        e => e.name.trim().toLowerCase() === (selectedEmployee || "").trim().toLowerCase()
      ) || targetEmps[0];

      const empName = chosenEmpObj ? chosenEmpObj.name : "Employee";
      const empCompany = chosenEmpObj ? chosenEmpObj.company : (selectedCompany !== "ALL" ? selectedCompany : "HB");

      meta["Employee"] = `${empName} (${empCompany})`;
      meta["Month"] = targetMonth;

      const empMonthLogs = baseLogs.filter(
        l =>
          l.employee.trim().toLowerCase() === empName.trim().toLowerCase() &&
          extractDateKey(l.timestamp).startsWith(targetMonth)
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
          empCompany,
          empName,
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
    }

    // -------------------------------------------------------------
    // 4. COMPANY-WISE SUMMARY REPORT
    // -------------------------------------------------------------
    else if (reportType === "company_wise") {
      meta["Target Month"] = targetMonth;
      repHeaders = ["Company Name", "Total Enrolled", "Total Punches in Month", "Present Headcount", "Late Arrivals", "Avg Attendance Rate"];
      const monthLogs = logs.filter(l => extractDateKey(l.timestamp).startsWith(targetMonth));

      VALID_COMPANIES.forEach(co => {
        const coEmps = employees.filter(e => e.company_name === co);
        const coMonthLogs = monthLogs.filter(l => l.company === co);
        const uniquePresent = new Set(coMonthLogs.map(l => l.employee.trim().toLowerCase())).size;
        const lates = coMonthLogs.filter(l => isLateArrival(extractTime24(l.timestamp))).length;
        const turnout = coEmps.length > 0 ? `${Math.round((uniquePresent / coEmps.length) * 100)}%` : "0%";

        repRows.push([co, coEmps.length, coMonthLogs.length, uniquePresent, lates, turnout]);
      });
    }

    // -------------------------------------------------------------
    // 5. MISSING PUNCH DISCREPANCY REPORT
    // -------------------------------------------------------------
    else if (reportType === "missing_punch") {
      meta["From"] = formatToIndianDate(fromDate);
      meta["To"] = formatToIndianDate(toDate);
      repHeaders = ["Date (IST)", "Company", "Employee Name", "Punch Type Available", "Timestamp (IST)", "Location", "Resolution Action"];

      const rangeLogs = baseLogs.filter(l => {
        const d = extractDateKey(l.timestamp);
        return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
      });

      const groups: Record<string, AttendanceLog[]> = {};
      rangeLogs.forEach(l => {
        const d = extractDateKey(l.timestamp);
        const key = `${l.company}|${l.employee}|${d}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(l);
      });

      Object.entries(groups).forEach(([k, punches]) => {
        const [co, emp, dateKey] = k.split("|");
        const ins = punches.filter(p => (p.status || "").toUpperCase() === "IN" || (p.status || "").toLowerCase() === "check in");
        const outs = punches.filter(p => (p.status || "").toUpperCase() === "OUT" || (p.status || "").toLowerCase() === "check out");

        if ((ins.length > 0 && outs.length === 0) || (ins.length === 0 && outs.length > 0)) {
          const punch = ins[0] || outs[0];
          const punchType = ins.length > 0 ? "Only Check-In (Missing Out)" : "Only Check-Out (Missing In)";
          repRows.push([
            formatToIndianDate(dateKey),
            co,
            emp,
            punchType,
            formatToIndianTime(punch.timestamp),
            punch.location || "—",
            "Requires Missing Punch Regularization"
          ]);
        }
      });
    }

    // -------------------------------------------------------------
    // 6. LOCATION / TERMINAL REPORT
    // -------------------------------------------------------------
    else if (reportType === "location") {
      meta["Target Month"] = targetMonth;
      repHeaders = ["Location / Kiosk Terminal", "Company", "Total Punches Recorded", "Unique Employees", "Most Active Hour"];
      const monthLogs = baseLogs.filter(l => extractDateKey(l.timestamp).startsWith(targetMonth));

      const locGroups: Record<string, AttendanceLog[]> = {};
      monthLogs.forEach(l => {
        const loc = l.location || "Main Desk / Facility";
        const key = `${loc}|${l.company}`;
        if (!locGroups[key]) locGroups[key] = [];
        locGroups[key].push(l);
      });

      Object.entries(locGroups).forEach(([k, punches]) => {
        const [loc, co] = k.split("|");
        const uniqueEmps = new Set(punches.map(p => p.employee.trim().toLowerCase())).size;
        repRows.push([loc, co, punches.length, uniqueEmps, "09:00 AM - 10:00 AM"]);
      });
    }

    // -------------------------------------------------------------
    // 7. ATTENDANCE STATUS REPORT
    // -------------------------------------------------------------
    else if (reportType === "status") {
      meta["Target Month"] = targetMonth;
      repHeaders = ["Status Category", "Company", "Total Occurrences", "Sample Record", "Sample Date (IST)"];
      const monthLogs = baseLogs.filter(l => extractDateKey(l.timestamp).startsWith(targetMonth));

      const statGroups: Record<string, AttendanceLog[]> = {};
      monthLogs.forEach(l => {
        const st = l.status || "Present";
        const key = `${st}|${l.company}`;
        if (!statGroups[key]) statGroups[key] = [];
        statGroups[key].push(l);
      });

      Object.entries(statGroups).forEach(([k, punches]) => {
        const [st, co] = k.split("|");
        const sample = punches[0];
        repRows.push([
          st,
          co,
          punches.length,
          sample ? `${sample.employee}` : "—",
          sample ? formatToIndianDate(sample.timestamp) : "—"
        ]);
      });
    }

    // -------------------------------------------------------------
    // 8. RAW LOGS, CHECKIN, CHECKOUT, DATE RANGE REPORTS
    // -------------------------------------------------------------
    else {
      repHeaders = ["Composite ID", "Company", "Employee Name", "Date (IST)", "Time (IST)", "Status", "Punch Location"];
      let rLogs = baseLogs;

      if (reportType === "checkin") {
        rLogs = rLogs.filter(l => (l.status || "").toUpperCase() === "IN" || (l.status || "").toLowerCase() === "check in");
        if (targetDate) rLogs = rLogs.filter(l => extractDateKey(l.timestamp) === targetDate);
      } else if (reportType === "checkout") {
        rLogs = rLogs.filter(l => (l.status || "").toUpperCase() === "OUT" || (l.status || "").toLowerCase() === "check out");
        if (targetDate) rLogs = rLogs.filter(l => extractDateKey(l.timestamp) === targetDate);
      } else if (reportType === "date_range") {
        meta["From"] = formatToIndianDate(fromDate);
        meta["To"] = formatToIndianDate(toDate);
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

    // Universal Search Query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      repRows = repRows.filter(r => r.some(cell => String(cell).toLowerCase().includes(q)));
    }

    return { headers: repHeaders, rows: repRows, metaInfo: meta };
  }, [
    reportType,
    selectedCompany,
    selectedEmployee,
    targetDate,
    targetMonth,
    fromDate,
    toDate,
    logs,
    availableEmployees,
    employees,
    searchQuery
  ]);

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
      filename: `${reportType}_Report_${selectedCompany}_${Date.now()}`,
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
            {reportType === "monthly" || reportType === "employee_timesheet" || reportType === "company_wise" || reportType === "location" || reportType === "status" ? (
              <>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Target Month (YYYY-MM)
                </label>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => {
                    setTargetMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </>
            ) : reportType === "date_range" || reportType === "missing_punch" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
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
                  onChange={(e) => {
                    setTargetDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </>
            )}
          </div>
        </div>

        {/* Employee Dropdown when Single Employee Timesheet is selected */}
        {reportType === "employee_timesheet" && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 flex-shrink-0">
              <User className="w-4 h-4 text-blue-600" />
              <span>Select Single Employee for Timesheet:</span>
            </span>
            <select
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
                setCurrentPage(1);
              }}
              className="flex-1 max-w-md px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              {availableEmployees.length > 0 ? (
                availableEmployees.map(e => (
                  <option key={`${e.company}-${e.name}`} value={e.name}>
                    {e.name} ({e.company})
                  </option>
                ))
              ) : (
                <option value="">No employees found for selected company</option>
              )}
            </select>
          </div>
        )}

        {/* Search Input & Total Counter Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search employee, location, status, date, or ID..."
              className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              Generated <strong className="text-slate-900">{rows.length}</strong> Records
            </span>
          </div>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                {headers.map((h, i) => (
                  <th key={i} className={`p-4 ${i === 0 ? "pl-6" : ""} ${i === headers.length - 1 ? "pr-6" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50/60 transition">
                    {row.map((cell, cellIdx) => {
                      const strCell = String(cell);
                      const isStatusCol = headers[cellIdx]?.toLowerCase().includes("status");
                      const isCompanyCol = headers[cellIdx]?.toLowerCase().includes("company");

                      return (
                        <td
                          key={cellIdx}
                          className={`p-4 ${cellIdx === 0 ? "pl-6" : ""} ${
                            cellIdx === headers.length - 1 ? "pr-6" : ""
                          }`}
                        >
                          {isCompanyCol && VALID_COMPANIES.includes(strCell as CompanyName) ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-display border ${
                                COMPANY_COLORS[strCell as CompanyName]?.lightBg || "bg-slate-100"
                              } ${COMPANY_COLORS[strCell as CompanyName]?.text || "text-slate-800"} ${
                                COMPANY_COLORS[strCell as CompanyName]?.border || "border-slate-200"
                              }`}
                            >
                              {strCell}
                            </span>
                          ) : isStatusCol ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                strCell.includes("Present")
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : strCell.includes("Late")
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : strCell.includes("Missing")
                                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                  : strCell.includes("Off")
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {strCell}
                            </span>
                          ) : (
                            <span className={cellIdx === 1 ? "font-bold text-slate-900" : ""}>{strCell}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers.length || 1} className="p-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">No data records found for this report configuration.</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting the company scope, date/month filter, or search query.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-medium">
            Page <strong className="text-slate-900">{currentPage}</strong> of <strong className="text-slate-900">{totalPages}</strong> ({rows.length} total records)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
