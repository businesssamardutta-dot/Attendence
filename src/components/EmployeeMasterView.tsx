import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Printer
} from "lucide-react";
import { CompanyName, Employee, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import { insertEmployeeToDB, updateEmployeeInDB, deleteEmployeeFromDB } from "../lib/supabaseClient";
import { exportToCSV, exportToExcel, exportToPDF, triggerPrintReport } from "../lib/exportUtils";
import { formatToIndianDate, formatToIndianDateTime } from "../lib/dateUtils";
import { logAuditEvent } from "../lib/auditStore";

interface EmployeeMasterViewProps {
  employees: Employee[];
  onRefreshEmployees: () => Promise<void>;
  selectedGlobalCompany: string;
  currentUser: UserProfile | null;
}

export default function EmployeeMasterView({
  employees,
  onRefreshEmployees,
  selectedGlobalCompany,
  currentUser
}: EmployeeMasterViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCompany, setFilterCompany] = useState<string>(selectedGlobalCompany || "ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<Employee | null>(null);

  // Form states
  const [formCompany, setFormCompany] = useState<CompanyName>("BHANGAKUTHI");
  const [formEmpName, setFormEmpName] = useState<string>("");
  const [formError, setFormError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Company count breakdown
  const companyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    VALID_COMPANIES.forEach(c => (counts[c] = 0));
    employees.forEach(e => {
      if (counts[e.company_name] !== undefined) {
        counts[e.company_name]++;
      }
    });
    return counts;
  }, [employees]);

  // Filtered employee list
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchCompany = filterCompany === "ALL" || e.company_name === filterCompany;
      const matchSearch =
        e.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.company_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCompany && matchSearch;
    });
  }, [employees, filterCompany, searchQuery]);

  const handleOpenAdd = () => {
    setFormCompany(filterCompany !== "ALL" ? (filterCompany as CompanyName) : "BHANGAKUTHI");
    setFormEmpName("");
    setFormError("");
    setEditingEmployee(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormCompany(emp.company_name);
    setFormEmpName(emp.employee_name);
    setFormError("");
    setIsAddModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanName = formEmpName.trim();
    if (!cleanName) {
      setFormError("Employee Name cannot be blank.");
      return;
    }

    // Duplicate check in frontend cache
    const duplicate = employees.find(
      emp =>
        emp.company_name === formCompany &&
        emp.employee_name.trim().toLowerCase() === cleanName.toLowerCase() &&
        (!editingEmployee || emp.id !== editingEmployee.id)
    );

    if (duplicate) {
      setFormError(`Employee '${cleanName}' already exists under company '${formCompany}'.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEmployee) {
        await updateEmployeeInDB(editingEmployee.id, {
          company_name: formCompany,
          employee_name: cleanName
        });
        logAuditEvent({
          user: currentUser?.username || "Admin",
          role: currentUser?.role || "Administrator",
          action: "Employee Updated",
          module: "Employee Master",
          company: formCompany,
          recordIdentifier: `EMP-${editingEmployee.id}`,
          previousValue: `${editingEmployee.company_name} - ${editingEmployee.employee_name}`,
          newValue: `${formCompany} - ${cleanName}`,
          reason: "Employee information edited"
        });
      } else {
        const created = await insertEmployeeToDB({
          company_name: formCompany,
          employee_name: cleanName
        });
        logAuditEvent({
          user: currentUser?.username || "Admin",
          role: currentUser?.role || "Administrator",
          action: "Employee Created",
          module: "Employee Master",
          company: formCompany,
          recordIdentifier: `EMP-${created.id || Date.now()}`,
          newValue: `${formCompany} - ${cleanName}`,
          reason: "New employee enrolled in master"
        });
      }

      await onRefreshEmployees();
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save employee to Supabase database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteConfirmEmp) return;
    setIsSubmitting(true);
    try {
      await deleteEmployeeFromDB(deleteConfirmEmp.id);
      logAuditEvent({
        user: currentUser?.username || "Admin",
        role: currentUser?.role || "Administrator",
        action: "Employee Deleted",
        module: "Employee Master",
        company: deleteConfirmEmp.company_name,
        recordIdentifier: `EMP-${deleteConfirmEmp.id}`,
        previousValue: `${deleteConfirmEmp.company_name} - ${deleteConfirmEmp.employee_name}`,
        reason: "Employee deleted from database"
      });
      await onRefreshEmployees();
      setDeleteConfirmEmp(null);
    } catch (err: any) {
      alert("Error deleting employee: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export handlers
  const handleExport = (type: "excel" | "csv" | "pdf" | "print") => {
    const headers = ["Employee ID", "Company Name", "Employee Name", "Enrolled Date", "Status"];
    const rows = filteredEmployees.map(e => [
      e.id,
      e.company_name,
      e.employee_name,
      e.created_at ? formatToIndianDate(e.created_at) : "Active Roster",
      e.is_active !== false ? "Active" : "Inactive"
    ]);

    const opts = {
      title: "Employee Master Roster",
      filename: `Employee_Master_${filterCompany}_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows,
      metaInfo: {
        "Company Filter": filterCompany,
        "Total Count": String(filteredEmployees.length)
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
            <Users className="w-7 h-7 text-blue-600" />
            <span>Employee Master Directory</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Manage company personnel, enforce duplicate checks, and synchronize active roster
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleExport("excel")}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
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
            <span>Print</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Company Count Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {VALID_COMPANIES.map(co => (
          <div
            key={co}
            onClick={() => setFilterCompany(filterCompany === co ? "ALL" : co)}
            className={`p-3.5 rounded-2xl border transition cursor-pointer ${
              filterCompany === co
                ? "bg-slate-900 text-white border-slate-900 shadow-md"
                : "bg-white text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                  filterCompany === co ? "bg-white/20 text-white" : "text-white"
                }`}
                style={{ backgroundColor: filterCompany === co ? undefined : COMPANY_COLORS[co]?.hex }}
              >
                {co}
              </span>
              <Building2 className={`w-3.5 h-3.5 ${filterCompany === co ? "text-slate-400" : "text-slate-400"}`} />
            </div>
            <div className="text-xl font-black font-display mt-2">
              {companyCounts[co] || 0}
            </div>
            <span className={`text-[10px] font-medium ${filterCompany === co ? "text-slate-300" : "text-slate-400"}`}>
              Enrolled Members
            </span>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee name or company..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full md:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-500">Company:</span>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Companies (5)</option>
              {VALID_COMPANIES.map(co => (
                <option key={co} value={co}>
                  {co}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs font-mono font-bold text-slate-500 whitespace-nowrap">
            Showing {filteredEmployees.length} of {employees.length}
          </span>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                <th className="p-4 pl-6">ID</th>
                <th className="p-4">Company Name</th>
                <th className="p-4">Employee Name</th>
                <th className="p-4">Enrolled Date</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 pl-6 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                      #{emp.id}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className="px-2.5 py-1 rounded-md text-[10px] font-extrabold text-white uppercase tracking-wider"
                        style={{ backgroundColor: COMPANY_COLORS[emp.company_name]?.hex || "#475569" }}
                      >
                        {emp.company_name}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-bold text-slate-900 text-sm">
                      {emp.employee_name}
                    </td>
                    <td className="p-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                      {emp.created_at ? formatToIndianDate(emp.created_at) : "System Default"}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Active</span>
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit Employee"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmEmp(emp)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 font-medium">
                    No employees found matching the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT EMPLOYEE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base font-display text-white">
                    {editingEmployee ? "Edit Employee Record" : "Enroll New Employee"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Supabase Table: <span className="font-mono text-blue-400">employee_master</span>
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Company Entity (5 Authorized Only)
                </label>
                <select
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value as CompanyName)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
                >
                  {VALID_COMPANIES.map(co => (
                    <option key={co} value={co}>
                      {co}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Note: 'HB-PL' is permanently forbidden. Only HBPL is supported.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Full Employee Name
                </label>
                <input
                  type="text"
                  required
                  value={formEmpName}
                  onChange={(e) => setFormEmpName(e.target.value)}
                  placeholder="e.g. Rahul Verma"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{editingEmployee ? "Update Employee" : "Enroll Employee"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmEmp && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-left">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              Confirm Employee Deletion
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to remove <strong className="text-slate-800">{deleteConfirmEmp.employee_name}</strong> from <strong className="text-slate-800">{deleteConfirmEmp.company_name}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmEmp(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-rose-500/20"
              >
                {isSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
