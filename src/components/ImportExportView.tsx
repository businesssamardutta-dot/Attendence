import React, { useState } from "react";
import {
  ArrowUpDown,
  Upload,
  Download,
  FileSpreadsheet,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import { CompanyName, Employee, UserProfile, VALID_COMPANIES } from "../types";
import { insertEmployeeToDB, insertAttendanceLog } from "../lib/supabaseClient";
import { exportToCSV, exportToExcel } from "../lib/exportUtils";
import { logAuditEvent } from "../lib/auditStore";

interface ImportExportViewProps {
  employees: Employee[];
  onRefreshEmployees: () => Promise<void>;
  onRefreshLogs: () => Promise<void>;
  currentUser: UserProfile | null;
}

export default function ImportExportView({
  employees,
  onRefreshEmployees,
  onRefreshLogs,
  currentUser
}: ImportExportViewProps) {
  const [importType, setImportType] = useState<"employees" | "attendance">("employees");
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<string>("");

  // Download Templates
  const handleDownloadTemplate = (type: "employees" | "attendance") => {
    if (type === "employees") {
      const headers = ["company_name", "employee_name"];
      const rows = [
        ["BHANGAKUTHI", "Ramkrishna Pal"],
        ["HB", "Sneha Mojumder"],
        ["HB-TP", "Abhijit Guha"],
        ["HBPL", "Rahul Verma"],
        ["SEFALI", "Sujay Kumar"]
      ];
      exportToExcel({
        title: "Employee Master Import Template",
        filename: "Template_Employee_Master",
        headers,
        rows
      });
    } else {
      const headers = ["company", "employee", "timestamp", "status", "location"];
      const rows = [
        ["HB", "Sneha Mojumder", "2026-06-01 08:47:39", "IN", "Nazrul Pally, Bardhaman"],
        ["HB", "Sneha Mojumder", "2026-06-01 19:53:23", "OUT", "B B Ghosh Road, Raniganj"],
        ["SEFALI", "Sujay Kumar", "2026-06-01 08:10:25", "IN", "Sefali Main Desk"],
        ["BHANGAKUTHI", "Ramkrishna Pal", "2026-06-01 08:15:00", "IN", "Bhangakuthi Main Gate"]
      ];
      exportToExcel({
        title: "Attendance Logs Import Template",
        filename: "Template_Attendance_Logs",
        headers,
        rows
      });
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParsedData([]);
    setValidationErrors([]);
    setImportSuccess("");

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) {
          setValidationErrors(["The uploaded file contains no data rows."]);
          return;
        }

        const errors: string[] = [];
        const validRows: any[] = [];

        rawJson.forEach((row, idx) => {
          const rowNum = idx + 2;
          if (importType === "employees") {
            const co = String(row.company_name || row.Company || "").trim();
            const name = String(row.employee_name || row.Employee || "").trim();

            if (co.toUpperCase() === "HB-PL") {
              errors.push(`Row ${rowNum}: 'HB-PL' is forbidden. Must use 'HBPL'.`);
              return;
            }

            if (!VALID_COMPANIES.includes(co as CompanyName)) {
              errors.push(`Row ${rowNum}: Invalid company '${co}'. Must be one of: ${VALID_COMPANIES.join(", ")}`);
              return;
            }

            if (!name) {
              errors.push(`Row ${rowNum}: Employee name is empty.`);
              return;
            }

            validRows.push({ company_name: co, employee_name: name });
          } else {
            // Attendance
            const co = String(row.company || row.Company || "").trim();
            const emp = String(row.employee || row.Employee || "").trim();
            const ts = String(row.timestamp || row.Timestamp || "").trim();
            const st = String(row.status || row.Status || "IN").trim().toUpperCase();
            const loc = String(row.location || row.Location || "Office Desk").trim();

            if (co.toUpperCase() === "HB-PL") {
              errors.push(`Row ${rowNum}: 'HB-PL' is forbidden.`);
              return;
            }

            if (!VALID_COMPANIES.includes(co as CompanyName)) {
              errors.push(`Row ${rowNum}: Invalid company '${co}'.`);
              return;
            }

            if (!emp || !ts) {
              errors.push(`Row ${rowNum}: Missing employee or timestamp.`);
              return;
            }

            validRows.push({
              company: co,
              employee: emp,
              timestamp: ts,
              status: st,
              location: loc
            });
          }
        });

        setValidationErrors(errors);
        setParsedData(validRows);
      } catch (err: any) {
        setValidationErrors([`File parse failed: ${err.message}`]);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Commit Parsed Records to Supabase
  const handleCommitImport = async () => {
    if (parsedData.length === 0) return;
    setIsProcessing(true);
    setImportSuccess("");

    let successCount = 0;
    let failCount = 0;

    try {
      if (importType === "employees") {
        for (const item of parsedData) {
          try {
            await insertEmployeeToDB(item);
            successCount++;
          } catch {
            failCount++;
          }
        }
        await onRefreshEmployees();
      } else {
        for (const item of parsedData) {
          try {
            await insertAttendanceLog(item);
            successCount++;
          } catch {
            failCount++;
          }
        }
        await onRefreshLogs();
      }

      logAuditEvent({
        user: currentUser?.username || "Admin",
        role: currentUser?.role || "Administrator",
        action: "Bulk Data Import",
        module: "Import / Export",
        newValue: `Imported ${successCount} records into ${importType}`,
        reason: "Bulk Excel/CSV upload"
      });

      setImportSuccess(`Successfully imported ${successCount} records into Supabase (${failCount} skipped/failed duplicates).`);
      setParsedData([]);
    } catch (err: any) {
      alert("Import error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-5xl mx-auto">
      {/* Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <ArrowUpDown className="w-7 h-7 text-blue-600" />
            <span>Bulk Data Import & Export</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Bulk ingestion of workforce master profiles and historical biometric punch logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadTemplate("employees")}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Employee Template</span>
          </button>
          <button
            onClick={() => handleDownloadTemplate("attendance")}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Attendance Template</span>
          </button>
        </div>
      </div>

      {/* Target Module Selector */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            setImportType("employees");
            setParsedData([]);
            setValidationErrors([]);
            setImportSuccess("");
          }}
          className={`p-5 rounded-3xl border text-left transition cursor-pointer ${
            importType === "employees"
              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
              : "bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <Users className="w-6 h-6" />
            {importType === "employees" && <CheckCircle2 className="w-5 h-5 text-white" />}
          </div>
          <h3 className="font-extrabold text-base mt-3 font-display">Employee Master Roster</h3>
          <p className={`text-xs mt-1 ${importType === "employees" ? "text-blue-100" : "text-slate-400"}`}>
            Bulk enroll staff into <span className="font-mono">employee_master</span> with duplicate prevention.
          </p>
        </button>

        <button
          onClick={() => {
            setImportType("attendance");
            setParsedData([]);
            setValidationErrors([]);
            setImportSuccess("");
          }}
          className={`p-5 rounded-3xl border text-left transition cursor-pointer ${
            importType === "attendance"
              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
              : "bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <Clock className="w-6 h-6" />
            {importType === "attendance" && <CheckCircle2 className="w-5 h-5 text-white" />}
          </div>
          <h3 className="font-extrabold text-base mt-3 font-display">Historical Attendance Logs</h3>
          <p className={`text-xs mt-1 ${importType === "attendance" ? "text-blue-100" : "text-slate-400"}`}>
            Bulk upload punches routed to the 5 authorized company tables.
          </p>
        </button>
      </div>

      {importSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{importSuccess}</span>
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 font-display">
            Upload Excel (.xlsx) or CSV File
          </h3>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Supported columns for {importType}: {importType === "employees" ? "company_name, employee_name" : "company, employee, timestamp, status, location"}
          </p>

          <label className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer inline-flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span>Select File to Parse</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-800 text-xs">
          <div className="flex items-center gap-2 font-bold mb-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Validation Warnings ({validationErrors.length})</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
            {validationErrors.slice(0, 8).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Table */}
      {parsedData.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Preview Parsed Records ({parsedData.length} Valid Rows)
            </span>
            <button
              onClick={handleCommitImport}
              disabled={isProcessing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              {isProcessing ? "Committing to Supabase..." : "Commit Import to Supabase"}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3 pl-6">#</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Employee</th>
                  {importType === "attendance" && (
                    <>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Location</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {parsedData.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-3 pl-6 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900">{row.company_name || row.company}</td>
                    <td className="p-3">{row.employee_name || row.employee}</td>
                    {importType === "attendance" && (
                      <>
                        <td className="p-3 font-mono">{row.timestamp}</td>
                        <td className="p-3 font-bold">{row.status}</td>
                        <td className="p-3 text-slate-500">{row.location}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
