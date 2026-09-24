import React, { useState, useEffect } from "react";
import { Clock, RefreshCw, PlusCircle, Building2, User, CheckCircle2, ShieldAlert } from "lucide-react";
import { CompanyName, UserProfile, VALID_COMPANIES, COMPANY_COLORS } from "../types";
import { formatToIndianDate, formatToIndianTime } from "../lib/dateUtils";

interface TopNavbarProps {
  currentUser: UserProfile | null;
  selectedCompany: string;
  setSelectedCompany: (co: string) => void;
  onOpenQuickPunch: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  collapsed: boolean;
}

export default function TopNavbar({
  currentUser,
  selectedCompany,
  setSelectedCompany,
  onOpenQuickPunch,
  onRefreshData,
  isRefreshing,
  collapsed
}: TopNavbarProps) {
  const [istTime, setIstTime] = useState<string>("");
  const [istDate, setIstDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format as DD-MM-YYYY and hh:mm:ss A in Indian Standard Time
      const datePart = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).replace(/\//g, "-");

      const timePart = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      setIstDate(datePart);
      setIstTime(timePart);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = currentUser?.role === "Administrator";

  return (
    <header
      className={`h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 flex items-center justify-between px-6 transition-all duration-300 ${
        collapsed ? "ml-20" : "ml-64"
      }`}
    >
      {/* Left side: Live IST Time and Date widget */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="font-bold text-slate-800 tracking-tight">{istDate || "24-09-2026"}</span>
            <span className="text-slate-300">|</span>
            <span className="font-extrabold text-blue-600 tracking-wider">{istTime || "12:00:00 PM"}</span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 px-1 py-0.2 rounded uppercase">
              IST (Asia/Kolkata)
            </span>
          </div>
        </div>

        {/* Supabase PostgreSQL Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg text-[11px] font-bold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Supabase PostgreSQL Live</span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Global Company Filter Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-1"
          >
            {isAdmin && <option value="ALL">🏢 All Companies (5)</option>}
            {VALID_COMPANIES.map(co => (
              <option key={co} value={co}>
                {co}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefreshData}
          disabled={isRefreshing}
          className={`p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer flex items-center justify-center ${
            isRefreshing ? "animate-spin text-blue-600" : ""
          }`}
          title="Refresh All Attendance & Roster from Supabase"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Quick Attendance Punch Button (Admin & Manager) */}
        {currentUser?.role !== "Employee" && (
          <button
            onClick={onOpenQuickPunch}
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Punch</span>
          </button>
        )}

        {/* User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            {currentUser?.username?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {currentUser?.username || "Admin"}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-tight">
              {currentUser?.role}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
