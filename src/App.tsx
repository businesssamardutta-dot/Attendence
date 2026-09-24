import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ActiveTab,
  CompanyName,
  Employee,
  AttendanceLog,
  UserProfile,
  VALID_COMPANIES
} from "./types";
import {
  fetchAllAttendanceLogs,
  fetchEmployeesFromDB
} from "./lib/supabaseClient";
import { getCurrentUser, logoutUser, initializeDefaultAdmin } from "./lib/authStore";
import { extractDateKey } from "./lib/dateUtils";

// Components
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";
import LoginModal from "./components/LoginModal";
import FirstPasswordChangeModal from "./components/FirstPasswordChangeModal";
import DashboardView from "./components/DashboardView";
import EmployeeMasterView from "./components/EmployeeMasterView";
import AttendanceEntryView from "./components/AttendanceEntryView";
import LiveAttendanceView from "./components/LiveAttendanceView";
import AllAttendanceLogsView from "./components/AllAttendanceLogsView";
import AttendanceCalendarView from "./components/AttendanceCalendarView";
import MissingPunchesView from "./components/MissingPunchesView";
import ReportsView from "./components/ReportsView";
import ImportExportView from "./components/ImportExportView";
import UserManagementView from "./components/UserManagementView";
import AuditLogsView from "./components/AuditLogsView";
import SettingsView from "./components/SettingsView";
import DataMaintenanceView from "./components/DataMaintenanceView";

export default function App() {
  // Initialize default Admin credentials
  useEffect(() => {
    initializeDefaultAdmin();
  }, []);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getCurrentUser());
  const [showFirstChangePassword, setShowFirstChangePassword] = useState<boolean>(
    currentUser?.mustChangePassword || false
  );

  // Active Navigation Tab & UI Layout
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [selectedGlobalCompany, setSelectedGlobalCompany] = useState<string>("ALL");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Reporting Navigation Parameters
  const [reportParams, setReportParams] = useState<any>(null);

  // Core Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data Loading Functions
  const loadEmployees = useCallback(async () => {
    try {
      const data = await fetchEmployeesFromDB();
      setEmployees(data);
    } catch (err) {
      console.error("Error loading employees:", err);
    }
  }, []);

  const loadAttendanceLogs = useCallback(async () => {
    try {
      const data = await fetchAllAttendanceLogs();
      setLogs(data);
    } catch (err) {
      console.error("Error loading attendance logs:", err);
    }
  }, []);

  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadEmployees(), loadAttendanceLogs()]);
    setIsLoading(false);
  }, [loadEmployees, loadAttendanceLogs]);

  // Initial Data Load
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Missing punches count calculation for badge
  const missingPunchCount = useMemo(() => {
    const groups: Record<string, { ins: number; outs: number }> = {};
    logs.forEach(l => {
      const d = extractDateKey(l.timestamp);
      if (!d) return;
      const key = `${l.company}_${l.employee}_${d}`;
      if (!groups[key]) groups[key] = { ins: 0, outs: 0 };
      const st = (l.status || "").toUpperCase();
      if (st === "IN" || st === "CHECK IN") groups[key].ins++;
      if (st === "OUT" || st === "CHECK OUT") groups[key].outs++;
    });

    return Object.values(groups).filter(g => (g.ins > 0 && g.outs === 0) || (g.ins === 0 && g.outs > 0)).length;
  }, [logs]);

  // Authentication Handlers
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.mustChangePassword) {
      setShowFirstChangePassword(true);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  const handlePasswordChangeCompleted = () => {
    const updated = getCurrentUser();
    setCurrentUser(updated);
    setShowFirstChangePassword(false);
  };

  const handleNavigateToReport = (type: string, date?: string) => {
    setReportParams({ reportType: type, date });
    setActiveTab("reports");
  };

  // If user is not authenticated, display login screen
  if (!currentUser) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  // If initial admin password change is required
  if (showFirstChangePassword) {
    return (
      <FirstPasswordChangeModal
        currentUser={currentUser}
        onPasswordChanged={handlePasswordChangeCompleted}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-850 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        selectedGlobalCompany={selectedGlobalCompany}
        setSelectedGlobalCompany={setSelectedGlobalCompany}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        missingPunchCount={missingPunchCount}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>
        {/* Top Navbar */}
        <TopNavbar
          currentUser={currentUser}
          selectedCompany={selectedGlobalCompany}
          setSelectedCompany={setSelectedGlobalCompany}
          onOpenQuickPunch={() => setActiveTab("attendance_entry")}
          onRefreshData={refreshAllData}
          isRefreshing={isLoading}
          collapsed={sidebarCollapsed}
        />

        {/* Scrollable Main View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          {activeTab === "dashboard" && (
            <DashboardView
              employees={employees}
              logs={logs}
              selectedCompany={selectedGlobalCompany}
              onNavigateTab={setActiveTab}
              currentUser={currentUser}
            />
          )}

          {activeTab === "employee_master" && (
            <EmployeeMasterView
              employees={employees}
              onRefreshEmployees={loadEmployees}
              currentUser={currentUser}
              selectedGlobalCompany={selectedGlobalCompany}
            />
          )}

          {activeTab === "attendance_entry" && (
            <AttendanceEntryView
              employees={employees}
              onRefreshLogs={loadAttendanceLogs}
              currentUser={currentUser}
              defaultCompany={selectedGlobalCompany !== "ALL" ? selectedGlobalCompany : "BHANGAKUTHI"}
            />
          )}

          {activeTab === "live_attendance" && (
            <LiveAttendanceView
              employees={employees}
              logs={logs}
              selectedGlobalCompany={selectedGlobalCompany}
              currentUser={currentUser}
            />
          )}

          {activeTab === "all_attendance_logs" && (
            <AllAttendanceLogsView
              logs={logs}
              employees={employees}
              onRefreshLogs={loadAttendanceLogs}
              selectedGlobalCompany={selectedGlobalCompany}
              currentUser={currentUser}
            />
          )}

          {activeTab === "attendance_calendar" && (
            <AttendanceCalendarView
              employees={employees}
              logs={logs}
              selectedGlobalCompany={selectedGlobalCompany}
              currentUser={currentUser}
            />
          )}

          {activeTab === "missing_punches" && (
            <MissingPunchesView
              logs={logs}
              employees={employees}
              onRefreshLogs={loadAttendanceLogs}
              selectedGlobalCompany={selectedGlobalCompany}
              currentUser={currentUser}
            />
          )}

          {activeTab === "reports" && (
            <ReportsView
              logs={logs}
              employees={employees}
              selectedGlobalCompany={selectedGlobalCompany}
              currentUser={currentUser}
              initialParams={reportParams}
            />
          )}

          {activeTab === "import_export" && (
            <ImportExportView
              employees={employees}
              onRefreshEmployees={loadEmployees}
              onRefreshLogs={loadAttendanceLogs}
              currentUser={currentUser}
            />
          )}

          {activeTab === "user_management" && (
            <UserManagementView currentUser={currentUser} />
          )}

          {activeTab === "audit_logs" && (
            <AuditLogsView />
          )}

          {activeTab === "settings" && (
            <SettingsView currentUser={currentUser} />
          )}

          {activeTab === "data_maintenance" && (
            <DataMaintenanceView
              logs={logs}
              onRefreshLogs={loadAttendanceLogs}
              currentUser={currentUser}
            />
          )}

          {activeTab === "change_password" && (
            <div className="max-w-md mx-auto mt-8">
              <FirstPasswordChangeModal
                currentUser={currentUser}
                onPasswordChanged={() => {
                  setActiveTab("dashboard");
                  handlePasswordChangeCompleted();
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
