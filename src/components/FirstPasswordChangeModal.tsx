import React, { useState } from "react";
import { KeyRound, ShieldAlert, CheckCircle2, Lock } from "lucide-react";
import { updatePassword } from "../lib/authStore";
import { UserProfile } from "../types";

interface FirstPasswordChangeModalProps {
  currentUser: UserProfile;
  onPasswordChanged: () => void;
}

export default function FirstPasswordChangeModal({
  currentUser,
  onPasswordChanged
}: FirstPasswordChangeModalProps) {
  const [newPass, setNewPass] = useState<string>("");
  const [confirmPass, setConfirmPass] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPass.length < 6) {
      setErrorMsg("Password must contain at least 6 characters.");
      return;
    }

    if (newPass === "Admin@1234") {
      setErrorMsg("New password cannot be the temporary default password.");
      return;
    }

    if (newPass !== confirmPass) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = updatePassword(currentUser.id, "Admin@1234", newPass);
      setIsLoading(false);
      if (res.success) {
        onPasswordChanged();
      } else {
        setErrorMsg(res.message);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left">
        <div className="bg-amber-500 p-6 text-white flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-600/60 flex items-center justify-center text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black font-display text-white">
              Password Update Required
            </h3>
            <p className="text-xs text-amber-100 font-medium">
              First-time login detected. Update your temporary password to continue.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              New Secure Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Password Security Policy:</span>
            </div>
            <p className="pl-5 text-slate-500">• Must be at least 6 characters.</p>
            <p className="pl-5 text-slate-500">• Avoid simple sequential numbers or reuse of 'Admin@1234'.</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Save Password & Proceed</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
