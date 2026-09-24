import React, { useState } from "react";
import { Lock, User, KeyRound, ShieldCheck, ArrowRight, Building2, AlertCircle } from "lucide-react";
import { authenticateUser } from "../lib/authStore";
import { UserProfile } from "../types";

interface LoginModalProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function LoginModal({ onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState<string>("Admin");
  const [password, setPassword] = useState<string>("Admin@1234");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    setTimeout(() => {
      const res = authenticateUser(username, password);
      setIsLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.message || "Invalid login credentials.");
      }
    }, 400);
  };

  const setQuickRole = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg("");
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 p-8 text-white text-center relative">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-extrabold font-display tracking-tight text-white">
            TIMETRACK PRO ENTERPRISE
          </h2>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            Supabase Unified Attendance Management
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-bold text-blue-200">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>5 Authorized Companies • IST Asia/Kolkata</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Username / Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Admin or admin@enterprise.in"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Initial Setup Credentials Helper */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
              Quick Role Switcher for Testing
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <button
                type="button"
                onClick={() => setQuickRole("Admin", "Admin@1234")}
                className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-xs font-bold transition cursor-pointer"
              >
                <span className="block text-[11px] font-extrabold text-blue-600">Admin</span>
                <span className="text-[9px] text-slate-400">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => setQuickRole("Manager_HB", "Manager@1234")}
                className="p-2 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-700 hover:text-amber-700 text-xs font-bold transition cursor-pointer"
              >
                <span className="block text-[11px] font-extrabold text-amber-600">Manager</span>
                <span className="text-[9px] text-slate-400">HB Units</span>
              </button>

              <button
                type="button"
                onClick={() => setQuickRole("Sneha_HB", "Employee@1234")}
                className="p-2 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-bold transition cursor-pointer"
              >
                <span className="block text-[11px] font-extrabold text-purple-600">Employee</span>
                <span className="text-[9px] text-slate-400">Self Portal</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
