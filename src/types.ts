export type CompanyName = "BHANGAKUTHI" | "HB" | "HB-TP" | "HBPL" | "SEFALI";

export const VALID_COMPANIES: CompanyName[] = [
  "BHANGAKUTHI",
  "HB",
  "HB-TP",
  "HBPL",
  "SEFALI"
];

export const COMPANY_COLORS: Record<CompanyName, { bg: string; text: string; border: string; hex: string; lightBg: string }> = {
  BHANGAKUTHI: { bg: "bg-emerald-600", text: "text-emerald-700", border: "border-emerald-300", hex: "#10b981", lightBg: "bg-emerald-50" },
  HB: { bg: "bg-blue-600", text: "text-blue-700", border: "border-blue-300", hex: "#2563eb", lightBg: "bg-blue-50" },
  "HB-TP": { bg: "bg-amber-500", text: "text-amber-700", border: "border-amber-300", hex: "#f59e0b", lightBg: "bg-amber-50" },
  HBPL: { bg: "bg-fuchsia-600", text: "text-fuchsia-700", border: "border-fuchsia-300", hex: "#c026d3", lightBg: "bg-fuchsia-50" },
  SEFALI: { bg: "bg-purple-600", text: "text-purple-700", border: "border-purple-300", hex: "#9333ea", lightBg: "bg-purple-50" }
};

export type UserRole = "Administrator" | "Company Manager" | "Employee";

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  fullName: string;
  role: UserRole;
  assignedCompanies?: CompanyName[]; // For Company Manager
  employeeName?: string; // For Employee role
  companyName?: CompanyName; // For Employee role
  mustChangePassword?: boolean;
  createdAt: string;
}

export interface Employee {
  id: number;
  company_name: CompanyName;
  employee_name: string;
  created_at?: string;
  is_active?: boolean;
  department?: string;
  designation?: string;
  phone?: string;
}

export type AttendanceStatus =
  | "IN"
  | "OUT"
  | "Check In"
  | "Check Out"
  | "Present"
  | "Absent"
  | "Late"
  | "Half Day"
  | "Leave"
  | "Weekly Off"
  | "Holiday"
  | "Outdoor Duty"
  | "Work From Home"
  | "Missing Punch";

export interface AttendanceLog {
  id?: number;
  company: CompanyName;
  employee: string;
  timestamp: string; // Stored in YYYY-MM-DD HH:mm:ss (Indian Local Time)
  status: string;
  location: string;
  compositeId?: string; // composite key: company-id
}

export interface PairedDailyShift {
  date: string; // YYYY-MM-DD
  formattedDate: string; // DD-MM-YYYY
  dayOfWeek: string;
  company: CompanyName;
  employee: string;
  firstInTime: string; // hh:mm:ss A or —
  firstInRaw?: string;
  firstInLocation: string;
  lastOutTime: string; // hh:mm:ss A or —
  lastOutRaw?: string;
  lastOutLocation: string;
  totalDurationText: string;
  totalDurationMinutes: number;
  status: "Present" | "Late" | "Missing Punch" | "Absent" | "Weekly Off" | "Leave" | "Half Day" | "Holiday" | "Work From Home";
  isSunday: boolean;
  allPunchesCount: number;
}

export interface AuditLog {
  id: string;
  timestamp: string; // DD-MM-YYYY hh:mm:ss A
  user: string;
  role: UserRole;
  action: string;
  module: string;
  company?: string;
  recordIdentifier?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress?: string;
}

export interface CompanyStats {
  companyName: CompanyName;
  totalEmployees: number;
  activeToday: number;
  checkedInToday: number;
  checkedOutToday: number;
  attendanceRate: number;
  lateCountToday: number;
  missingPunchCount: number;
}

export interface DashboardStats {
  totalEmployees: number;
  totalCheckInsToday: number;
  totalCheckOutsToday: number;
  activePresentCount: number;
  totalAbsentToday: number;
  totalLateToday: number;
  totalMissingPunches: number;
  totalOnLeave: number;
  totalAttendanceLogs: number;
  todayAttendanceLogs: number;
  companyStats: CompanyStats[];
}

export type ActiveTab =
  | "dashboard"
  | "employee_master"
  | "attendance_entry"
  | "live_attendance"
  | "all_attendance_logs"
  | "attendance_calendar"
  | "missing_punches"
  | "reports"
  | "import_export"
  | "user_management"
  | "audit_logs"
  | "settings"
  | "data_maintenance"
  | "change_password";
