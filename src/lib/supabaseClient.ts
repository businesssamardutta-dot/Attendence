import { createClient } from "@supabase/supabase-js";
import { AttendanceLog, CompanyName, Employee, VALID_COMPANIES } from "../types";
import { FALLBACK_ATTENDANCE_LOGS, FALLBACK_EMPLOYEES } from "../data/fallbackData";

const SUPABASE_URL = "https://zakajrrmzzybyptypjdt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha2FqcnJtenp5YnlwdHlwamR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODk4NzMsImV4cCI6MjA5NTg2NTg3M30.IrWQsa1s6kzgNzhoa-NXOtz9OUeKZcY2MF6e8Zp4LXU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Map company name to exact Supabase table name
export function getCompanyTableName(company: string): CompanyName | null {
  const clean = company.trim();
  if (clean === "HB-PL") {
    // Prohibited! Force valid company HBPL
    return "HBPL";
  }
  const found = VALID_COMPANIES.find(c => c.toUpperCase() === clean.toUpperCase());
  return found || null;
}

// ----------------------------------------------------------------------
// EMPLOYEE MASTER DATABASE OPERATIONS
// ----------------------------------------------------------------------

export async function fetchEmployeesFromDB(): Promise<Employee[]> {
  try {
    const { data, error } = await supabase
      .from("employee_master")
      .select("*")
      .order("company_name", { ascending: true })
      .order("employee_name", { ascending: true });

    if (!error && data && data.length > 0) {
      // Filter out any invalid legacy companies like HB-PL
      return data
        .filter(emp => emp.company_name !== "HB-PL" && VALID_COMPANIES.includes(emp.company_name as CompanyName))
        .map(emp => ({
          ...emp,
          company_name: emp.company_name as CompanyName,
          is_active: emp.is_active !== undefined ? emp.is_active : true
        }));
    }
  } catch (err) {
    console.warn("Could not load employees from Supabase employee_master, using cache:", err);
  }

  return FALLBACK_EMPLOYEES;
}

export async function insertEmployeeToDB(employee: { company_name: CompanyName; employee_name: string }): Promise<Employee> {
  const cleanCo = getCompanyTableName(employee.company_name);
  if (!cleanCo) {
    throw new Error(`Invalid company '${employee.company_name}'. Must be one of: ${VALID_COMPANIES.join(", ")}`);
  }

  const cleanName = employee.employee_name.trim();
  if (!cleanName) {
    throw new Error("Employee name is required.");
  }

  // Check duplicate in same company
  const { data: existing } = await supabase
    .from("employee_master")
    .select("id")
    .eq("company_name", cleanCo)
    .ilike("employee_name", cleanName);

  if (existing && existing.length > 0) {
    throw new Error(`Employee '${cleanName}' already exists under company '${cleanCo}'.`);
  }

  const { data, error } = await supabase
    .from("employee_master")
    .insert([{
      company_name: cleanCo,
      employee_name: cleanName
    }])
    .select();

  if (error) {
    throw error;
  }

  return data[0];
}

export async function updateEmployeeInDB(id: number, updates: { company_name: CompanyName; employee_name: string }): Promise<Employee> {
  const cleanCo = getCompanyTableName(updates.company_name);
  if (!cleanCo) throw new Error("Invalid company selected.");

  const { data, error } = await supabase
    .from("employee_master")
    .update({
      company_name: cleanCo,
      employee_name: updates.employee_name.trim()
    })
    .eq("id", id)
    .select();

  if (error) throw error;
  return data[0];
}

export async function deleteEmployeeFromDB(id: number): Promise<void> {
  const { error } = await supabase
    .from("employee_master")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ----------------------------------------------------------------------
// ATTENDANCE LOGS DATABASE OPERATIONS
// ----------------------------------------------------------------------

// Dynamically routes an attendance log to the correct company database table in Supabase
export async function insertAttendanceLog(log: {
  company: CompanyName;
  employee: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  status: string;
  location: string;
}): Promise<AttendanceLog> {
  const companyTable = getCompanyTableName(log.company);
  if (!companyTable) {
    throw new Error(`Company '${log.company}' is invalid. Allowed: ${VALID_COMPANIES.join(", ")}`);
  }

  const { data, error } = await supabase
    .from(companyTable)
    .insert([{
      company: companyTable,
      employee: log.employee.trim(),
      timestamp: log.timestamp,
      status: log.status,
      location: log.location ? log.location.trim() : "Office Desk"
    }])
    .select();

  if (error) {
    throw error;
  }

  const inserted = data?.[0] || log;
  return {
    ...inserted,
    company: companyTable,
    compositeId: `${companyTable}-${inserted.id || Date.now()}`
  };
}

// Update single attendance record in its origin company table
export async function updateAttendanceRecordInDB(
  company: CompanyName,
  numericId: number,
  updates: { employee?: string; timestamp?: string; status?: string; location?: string }
): Promise<void> {
  const companyTable = getCompanyTableName(company);
  if (!companyTable) throw new Error(`Invalid target company '${company}'.`);

  const { error } = await supabase
    .from(companyTable)
    .update(updates)
    .eq("id", numericId);

  if (error) throw error;
}

// Delete single attendance record from its origin company table
export async function deleteAttendanceRecordFromDB(company: CompanyName, numericId: number): Promise<void> {
  const companyTable = getCompanyTableName(company);
  if (!companyTable) throw new Error(`Invalid target company '${company}'.`);

  const { error } = await supabase
    .from(companyTable)
    .delete()
    .eq("id", numericId);

  if (error) throw error;
}

// Fetch all attendance logs by combining tables, attaching composite ID
export async function fetchAllAttendanceLogs(): Promise<AttendanceLog[]> {
  try {
    // Query unified view if available
    const { data: viewData, error: viewError } = await supabase
      .from("all_attendance_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(25000);

    if (!viewError && viewData && viewData.length > 0) {
      return viewData
        .filter(l => l.company !== "HB-PL" && VALID_COMPANIES.includes(l.company as CompanyName))
        .map(l => ({
          ...l,
          company: l.company as CompanyName,
          compositeId: `${l.company}-${l.id}`
        }));
    }
  } catch (e) {
    console.warn("Unified view query failed, querying individual company tables:", e);
  }

  // Parallel fetch across the 5 valid company tables
  const promises = VALID_COMPANIES.map(async (co) => {
    try {
      const { data, error } = await supabase
        .from(co)
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(10000);

      if (error) {
        console.warn(`Query for table ${co} error:`, error.message);
        return [];
      }
      return (data || []).map(r => ({
        ...r,
        company: co,
        compositeId: `${co}-${r.id}`
      }));
    } catch (err) {
      return [];
    }
  });

  const results = await Promise.all(promises);
  const combined: AttendanceLog[] = [];
  results.forEach(res => {
    combined.push(...res);
  });

  if (combined.length === 0) {
    return FALLBACK_ATTENDANCE_LOGS.map(l => ({
      ...l,
      company: l.company as CompanyName,
      compositeId: `${l.company}-${l.id}`
    }));
  }

  // Sort by timestamp descending
  combined.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return combined;
}

// ----------------------------------------------------------------------
// DATA MAINTENANCE & CLEANUP OPERATIONS
// ----------------------------------------------------------------------

export async function previewCutoffRecordCounts(cutoffTimestamp: string = "2026-04-01 00:00:00"): Promise<Record<CompanyName, number>> {
  const counts: Record<string, number> = {};

  for (const co of VALID_COMPANIES) {
    try {
      const { count, error } = await supabase
        .from(co)
        .select("*", { count: "exact", head: true })
        .lt("timestamp", cutoffTimestamp);

      counts[co] = error ? 0 : (count || 0);
    } catch {
      counts[co] = 0;
    }
  }

  return counts as Record<CompanyName, number>;
}

export async function deleteLogsBeforeCutoff(cutoffTimestamp: string = "2026-04-01 00:00:00"): Promise<{ company: CompanyName; deletedCount: number }[]> {
  const purgePromises = VALID_COMPANIES.map(async (companyTable) => {
    const { data, error } = await supabase
      .from(companyTable)
      .delete()
      .lt("timestamp", cutoffTimestamp)
      .select();

    if (error) {
      console.error(`Error deleting from table ${companyTable}:`, error);
      throw error;
    }
    return { company: companyTable, deletedCount: data ? data.length : 0 };
  });

  return await Promise.all(purgePromises);
}
