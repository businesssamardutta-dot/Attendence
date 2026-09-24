import React, { useState } from "react";
import {
  Sliders,
  Clock,
  Building2,
  Globe,
  ShieldCheck,
  Save,
  CheckCircle2,
  Info
} from "lucide-react";
import { VALID_COMPANIES, UserProfile } from "../types";
import { logAuditEvent } from "../lib/auditStore";

interface SettingsViewProps {
  currentUser: UserProfile | null;
}

export default function SettingsView({ currentUser }: SettingsViewProps) {
  const [graceTime, setGraceTime] = useState<string>("09:30:00");
  const [minFullDayHours, setMinFullDayHours] = useState<number>(8.0);
  const [minHalfDayHours, setMinHalfDayHours] = useState<number>(4.5);
  const [feedback, setFeedback] = useState<string>("");

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    logAuditEvent({
      user: currentUser?.username || "Admin",
      role: currentUser?.role || "Administrator",
      action: "System Settings Updated",
      module: "Settings",
      newValue: `Grace Time: ${graceTime} | Full Day: ${minFullDayHours}h | Half Day: ${minHalfDayHours}h`,
      reason: "Shift policy modification"
    });

    setFeedback("Shift & attendance calculation settings saved successfully.");
    setTimeout(() => setFeedback(""), 4000);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-4xl mx-auto">
      {/* Banner */}
      <div>
        <h1 className="text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2.5">
          <Sliders className="w-7 h-7 text-blue-600" />
          <span>System Settings & Shift Policies</span>
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Configure business rules, Indian Standard Time parameters, and company parameters
        </p>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Shift Timing Rules Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-base font-display text-slate-900">
              Shift Attendance Rules
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Late Arrival Cutoff Time
              </label>
              <input
                type="text"
                value={graceTime}
                onChange={(e) => setGraceTime(e.target.value)}
                placeholder="09:30:00"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Punches after this IST time are flagged as "Late Arrival".
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Full-Day Required Hours
              </label>
              <input
                type="number"
                step="0.5"
                value={minFullDayHours}
                onChange={(e) => setMinFullDayHours(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Standard full shift duration (e.g. 8.0 hours).
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Half-Day Minimum Hours
              </label>
              <input
                type="number"
                step="0.5"
                value={minHalfDayHours}
                onChange={(e) => setMinHalfDayHours(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Threshold below which shift is marked Half Day.
              </span>
            </div>
          </div>
        </div>

        {/* Database & Company Registry Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-base font-display text-slate-900">
              Enterprise Company Registry
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            The application operates across exactly five authorized Supabase PostgreSQL tables:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {VALID_COMPANIES.map(co => (
              <div key={co} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="font-extrabold text-xs text-slate-900 font-display block">{co}</span>
                <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Active Table</span>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Compliance Notice:</strong> Company <code className="font-bold">HB-PL</code> has been permanently decommissioned and is strictly blocked across all database queries, dropdowns, and imports. Only <code className="font-bold">HBPL</code> is recognized.
            </div>
          </div>
        </div>

        {/* Timezone Configuration Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-base font-display text-slate-900">
              Timezone & Formatting Standards
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Standard Timezone</span>
              <span className="font-mono font-bold text-slate-900 text-sm">Asia/Kolkata (IST)</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Date Format</span>
              <span className="font-mono font-bold text-slate-900 text-sm">DD-MM-YYYY</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Time Format</span>
              <span className="font-mono font-bold text-slate-900 text-sm">hh:mm:ss A (12-Hour)</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Shift Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
