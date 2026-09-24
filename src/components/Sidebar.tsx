import React from "react";
import {
  LayoutDashboard,
  Users,
  Clock,
  Radio,
  FileSpreadsheet,
  CalendarDays,
  AlertTriangle,
  BarChart3,
  ArrowUpDown,
  UserCheck,
  ShieldCheck,
  Sliders,
  DatabaseZap,
  KeyRound,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  Lock
} from "lucide-react";
import { ActiveTab, CompanyName, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import { canManageEmployees, canManageUsers, canExecuteMaintenance } from "../lib/authStore";

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserProfile | null;
  selectedGlobalCompany: string;
  setSelectedGlobalCompany: (co: string) => void;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  missingPunchCount: number;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  selectedGlobalCompany,
  setSelectedGlobalCompany,
  onLogout,
  collapsed,
  setCollapsed,
  missingPunchCount
}: SidebarProps) {
  const isAdmin = currentUser?.role === "Administrator";
  const isManager = currentUser?.role === "Company Manager";

  const MENU_ITEMS = [
    { id: "dashboard" as ActiveTab, label: "Dashboard", icon: LayoutDashboard, badge: null, roles: ["Administrator", "Company Manager", "Employee"] },
    { id: "employee_master" as ActiveTab, label: "Employee Master", icon: Users, badge: null, roles: ["Administrator", "Company Manager"] },
    { id: "attendance_entry" as ActiveTab, label: "Attendance Entry", icon: Clock, badge: null, roles: ["Administrator", "Company Manager"] },
    { id: "live_attendance" as ActiveTab, label: "Live Attendance", icon: Radio, badge: "Live", roles: ["Administrator", "Company Manager", "Employee"] },
    { id: "all_attendance_logs" as ActiveTab, label: "All Attendance Logs", icon: FileSpreadsheet, badge: null, roles: ["Administrator", "Company Manager", "Employee"] },
    { id: "attendance_calendar" as ActiveTab, label: "Attendance Calendar", icon: CalendarDays, badge: null, roles: ["Administrator", "Company Manager", "Employee"] },
    { id: "missing_punches" as ActiveTab, label: "Missing Punches", icon: AlertTriangle, badge: missingPunchCount > 0 ? missingPunchCount : null, badgeColor: "bg-amber-500", roles: ["Administrator", "Company Manager"] },
    { id: "reports" as ActiveTab, label: "Reports", icon: BarChart3, badge: "14", roles: ["Administrator", "Company Manager", "Employee"] },
    { id: "import_export" as ActiveTab, label: "Import / Export", icon: ArrowUpDown, badge: null, roles: ["Administrator", "Company Manager"] },
    { id: "user_management" as ActiveTab, label: "User Management", icon: UserCheck, badge: null, roles: ["Administrator"] },
    { id: "audit_logs" as ActiveTab, label: "Audit Logs", icon: ShieldCheck, badge: null, roles: ["Administrator"] },
    { id: "settings" as ActiveTab, label: "Settings", icon: Sliders, badge: null, roles: ["Administrator", "Company Manager"] },
    { id: "data_maintenance" as ActiveTab, label: "Data Maintenance", icon: DatabaseZap, badge: "Protected", badgeColor: "bg-rose-500", roles: ["Administrator"] },
    { id: "change_password" as ActiveTab, label: "Change Password", icon: KeyRound, badge: null, roles: ["Administrator", "Company Manager", "Employee"] }
  ];

  const allowedItems = MENU_ITEMS.filter(item => {
    if (!currentUser) return false;
    return item.roles.includes(currentUser.role);
  });

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 bg-slate-900 text-slate-300 z-40 flex flex-col transition-all duration-300 shadow-xl border-r border-slate-800 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/60">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black shadow-md shadow-blue-500/20 flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex flex-col truncate">
              <span className="font-extrabold text-white text-sm tracking-tight font-display">
                TIMETRACK <span className="text-blue-400">PRO</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase truncate">
                5 Enterprise Units
              </span>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black shadow-md">
            <Clock className="w-5 h-5" />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ${
            collapsed ? "mx-auto mt-2" : ""
          }`}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Global Company Scope Selector in Sidebar */}
      {!collapsed && (
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/50">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3 text-blue-400" />
              Company Scope
            </span>
            {selectedGlobalCompany !== "ALL" && (
              <span className="text-[9px] text-blue-400 font-bold">Filtered</span>
            )}
          </label>
          <select
            value={selectedGlobalCompany}
            onChange={(e) => setSelectedGlobalCompany(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 text-white rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {isAdmin && <option value="ALL">🏢 All 5 Companies</option>}
            {VALID_COMPANIES.map(co => (
              <option key={co} value={co}>
                {co}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 custom-scrollbar">
        {allowedItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group cursor-pointer ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400"}`} />
              
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between truncate text-left">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-md text-white uppercase tracking-wider ${
                        item.badgeColor || (isActive ? "bg-blue-800 text-blue-100" : "bg-blue-600/30 text-blue-300 border border-blue-500/30")
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-xs flex-shrink-0">
                {currentUser?.fullName?.charAt(0) || "U"}
              </div>
              <div className="flex flex-col min-w-0 truncate">
                <span className="text-xs font-bold text-slate-200 truncate leading-tight">
                  {currentUser?.fullName || "User"}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold truncate leading-tight">
                  {currentUser?.role}
                </span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
              title="Logout Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
            title="Logout Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
