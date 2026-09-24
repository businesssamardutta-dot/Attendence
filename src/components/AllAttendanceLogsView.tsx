import React, { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  Building2,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  X
} from "lucide-react";
import { AttendanceLog, CompanyName, Employee, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import { updateAttendanceRecordInDB, deleteAttendanceRecordFromDB } from "../lib/supabaseClient";
import { exportToCSV, exportToExcel, exportToPDF, triggerPrintReport } from "../lib/exportUtils";
import { formatToIndianDate, formatToIndianTime, formatToIndianDateTime } from "../lib/dateUtils";
import { logAuditEvent } from "../lib/auditStore";
import { canEditAttendance, canDeleteAttendance } from "../lib/authStore";

interface AllAttendanceLogsViewProps {
  logs: AttendanceLog[];
  employees: Employee[];
  onRefreshLogs: () => Promise<void>;
  selectedGlobalCompany: string;
  currentUser: UserProfile | null;
}

export default function AllAttendanceLogsView({
  logs,
  employees,
  onRefreshLogs,
  selectedGlobalCompany,
  currentUser
}: AllAttendanceLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>(selectedGlobalCompany || "ALL");
  const [employeeFilter, setEmployeeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [locationFilter, setLocationFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortField, setSortField] = useState<"timestamp" | "employee" | "company">("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Edit / Delete Modal State
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<AttendanceLog | null>(null);
  const [editForm, setEditForm] = useState<{ timestamp: string; status: string; location: string; reason: string }>({
    timestamp: "",
    status: "",
    location: "",
    reason: ""
  });
  const [modalError, setModalError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Extract unique locations for filter
  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.location) set.add(l.location.trim());
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchCompany = companyFilter === "ALL" || log.company === companyFilter;
      const matchEmployee = employeeFilter === "ALL" || log.employee.toLowerCase() === employeeFilter.toLowerCase();
      const matchStatus =
        statusFilter === "ALL" ||
        (log.status || "").trim().toUpperCase() === statusFilter.toUpperCase();
      const matchLoc = locationFilter === "ALL" || (log.location || "").toLowerCase().includes(locationFilter.toLowerCase());

      // Search Query
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        log.employee.toLowerCase().includes(q) ||
        log.company.toLowerCase().includes(q) ||
        (log.location || "").toLowerCase().includes(q) ||
        (log.compositeId || "").toLowerCase().includes(q);

      // Date range filter
      let matchDate = true;
      const logDate = (log.timestamp || "").split(" ")[0];
      if (fromDate && logDate < fromDate) matchDate = false;
      if (toDate && logDate > toDate) matchDate = false;

      return matchCompany && matchEmployee && matchStatus && matchLoc && matchSearch && matchDate;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === "timestamp") {
        comparison = (a.timestamp || "").localeCompare(b.timestamp || "");
      } else if (sortField === "employee") {
        comparison = (a.employee || "").localeCompare(b.employee || "");
      } else if (sortField === "company") {
        comparison = (a.company || "").localeCompare(b.company || "");
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });
  }, [logs, companyFilter, employeeFilter, statusFilter, locationFilter, searchQuery, fromDate, toDate, sortField, sortOrder]);

  // Paginated records
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Open Edit Modal
  const handleOpenEdit = (log: AttendanceLog) => {
    setEditingLog(log);
    setEditForm({
      timestamp: log.timestamp || "",
      status: log.status || "IN",
      location: log.location || "",
      reason: "Manual administrative correction"
    });
    setModalError("");
  };

  // Save Record Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || !editingLog.id) {
      setModalError("Missing numeric record ID.");
      return;
    }

    setIsProcessing(true);
    try {
      await updateAttendanceRecordInDB(editingLog.company, editingLog.id, {
        timestamp: editForm.timestamp,
        status: editForm.status,
        location: editForm.location
      });

      logAuditEvent({
        user: currentUser?.username || "Admin",
        role: currentUser?.role || "Administrator",
        action: "Attendance Corrected",
        module: "All Attendance Logs",
        company: editingLog.company,
        recordIdentifier: editingLog.compositeId || `${editingLog.company}-${editingLog.id}`,
        previousValue: `${editingLog.timestamp} | ${editingLog.status} | ${editingLog.location}`,
        newValue: `${editForm.timestamp} | ${editForm.status} | ${editForm.location}`,
        reason: editForm.reason
      });

      await onRefreshLogs();
      setEditingLog(null);
    } catch (err: any) {
      setModalError(err.message || "Failed to update record in Supabase.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Record
  const handleConfirmDelete = async () => {
    if (!deletingLog || !deletingLog.id) return;
    setIsProcessing(true);
    try {
      await deleteAttendanceRecordFromDB(deletingLog.company, deletingLog.id);

      logAuditEvent({
        user: currentUser?.username || "Admin",
        role: currentUser?.role || "Administrator",
        action: "Attendance Deleted",
        module: "All Attendance Logs",
        company: deletingLog.company,
        recordIdentifier: deletingLog.compositeId || `${deletingLog.company}-${deletingLog.id}`,
        previousValue: `${deletingLog.employee} | ${deletingLog.timestamp} | ${deletingLog.status}`,
        reason: "Administrative record deletion"
      });

      await onRefreshLogs();
      setDeletingLog(null);
    } catch (err: any) {
      alert("Error deleting record: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Export handlers
  const handleExport = (type: "excel" | "csv" | "pdf" | "print") => {
    const headers = ["Composite ID", "Company", "Employee Name", "Date (IST)", "Time (IST)", "Status", "Punch Location"];
    const rows = filteredLogs.map(l => [
      l.compositeId || `${l.company}-${l.id}`,
      l.company,
      l.employee,
      formatToIndianDate(l.timestamp),
      formatToIndianTime(l.timestamp),
      l.status,
      l.location || "Office"
    ]);

    const opts = {
      title: "All Attendance Logs Report",
      filename: `Attendance_Logs_${companyFilter}_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows,
      metaInfo: {
        Company: companyFilter,
        "Total Filtered Logs": String(filteredLogs.length),
        "Date Scope": fromDate || toDate ? `${fromDate || "Start"} to ${toDate || "End"}` : "All Recorded Dates"
      }
    };

    if (type === "excel") exportToExcel(opts);
    else if (type === "csv") exportToCSV(opts);
    else if (type === "pdf") exportToPDF(opts);
    else if (type === "print") triggerPrintReport(opts);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setCompanyFilter("ALL");
    setEmployeeFilter("ALL");
    setStatusFilter("ALL");
    setLocationFilter("ALL");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-blue-600" />
            <span>Unified Attendance Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Cross-company attendance records unified with collision-safe composite IDs (<code>company-id</code>)
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

      {/* Multi-Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Global Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search employee, ID, location..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Company Filter */}
          <div>
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
            >
              <option value="ALL">🏢 All Companies (5)</option>
              {VALID_COMPANIES.map(co => (
                <option key={co} value={co}>
                  {co}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
            >
              <option value="ALL">All Punch Statuses</option>
              <option value="IN">IN (Check In)</option>
              <option value="OUT">OUT (Check Out)</option>
              <option value="Present">Present</option>
              <option value="Late">Late Arrival</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
            >
              <option value="ALL">All Locations</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range & Reset */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-400">Date Range:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-600"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Reset Filters
            </button>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
              Found {filteredLogs.length} Records
            </span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                <th className="p-4 pl-6">Composite Key</th>
                <th className="p-4">Company</th>
                <th className="p-4">Employee</th>
                <th className="p-4">Date (IST)</th>
                <th className="p-4">Time (IST)</th>
                <th className="p-4">Status</th>
                <th className="p-4">Punch Location</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => {
                  const compKey = log.compositeId || `${log.company}-${log.id}`;
                  const isPunchIn = (log.status || "").toUpperCase() === "IN" || (log.status || "").toLowerCase() === "check in";

                  return (
                    <tr key={compKey} className="hover:bg-slate-50/60 transition">
                      <td className="p-4 pl-6 whitespace-nowrap font-mono text-slate-500 font-bold text-[11px]">
                        {compKey}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className="px-2.5 py-1 rounded-md text-[10px] font-extrabold text-white uppercase tracking-wider"
                          style={{ backgroundColor: COMPANY_COLORS[log.company]?.hex || "#475569" }}
                        >
                          {log.company}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap font-bold text-slate-900 text-sm">
                        {log.employee}
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-700">
                        {formatToIndianDate(log.timestamp)}
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-900">
                        {formatToIndianTime(log.timestamp)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isPunchIn
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 max-w-xs truncate" title={log.location}>
                        {log.location || "Office"}
                      </td>
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEditAttendance(currentUser) && (
                            <button
                              onClick={() => handleOpenEdit(log)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Correct Record"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canDeleteAttendance(currentUser) && (
                            <button
                              onClick={() => setDeletingLog(log)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                    No attendance records match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-800">
              {currentPage}
            </span>
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

      {/* EDIT RECORD MODAL */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base font-display text-white">
                  Correct Attendance Punch
                </h3>
                <p className="text-xs text-slate-400">
                  Target Table: <span className="font-mono text-blue-400">{editingLog.company}</span> • ID #{editingLog.id}
                </p>
              </div>
              <button onClick={() => setEditingLog(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {modalError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Employee
                </label>
                <input
                  type="text"
                  disabled
                  value={editingLog.employee}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Timestamp (YYYY-MM-DD HH:mm:ss)
                </label>
                <input
                  type="text"
                  required
                  value={editForm.timestamp}
                  onChange={(e) => setEditForm({ ...editForm, timestamp: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="IN">IN (Check In)</option>
                  <option value="OUT">OUT (Check Out)</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Terminal / Location
                </label>
                <input
                  type="text"
                  required
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Correction Reason (Audit Trail)
                </label>
                <input
                  type="text"
                  required
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="e.g. Employee forgot punch, verified with supervisor"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {isProcessing ? "Updating..." : "Save Correction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingLog && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-left">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              Confirm Punch Deletion
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Delete punch for <strong className="text-slate-800">{deletingLog.employee}</strong> at <strong className="font-mono text-slate-800">{deletingLog.timestamp}</strong> from company table <strong className="font-mono text-blue-600">{deletingLog.company}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setDeletingLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-rose-500/20"
              >
                {isProcessing ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
