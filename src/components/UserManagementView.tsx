import React, { useState } from "react";
import {
  UserCheck,
  Plus,
  ShieldCheck,
  KeyRound,
  Building2,
  User,
  Mail,
  Lock,
  Trash2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { CompanyName, UserProfile, UserRole, VALID_COMPANIES } from "../types";
import { getRegisteredUsers, saveRegisteredUsers } from "../lib/authStore";
import { logAuditEvent } from "../lib/auditStore";

interface UserManagementViewProps {
  currentUser: UserProfile | null;
}

export default function UserManagementView({ currentUser }: UserManagementViewProps) {
  const [users, setUsers] = useState(getRegisteredUsers());
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>("");

  // Form State
  const [formUsername, setFormUsername] = useState<string>("");
  const [formEmail, setFormEmail] = useState<string>("");
  const [formFullName, setFormFullName] = useState<string>("");
  const [formRole, setFormRole] = useState<UserRole>("Company Manager");
  const [formAssignedCo, setFormAssignedCo] = useState<CompanyName[]>(["HB"]);
  const [formPassword, setFormPassword] = useState<string>("User@1234");
  const [formError, setFormError] = useState<string>("");

  const handleToggleCompany = (co: CompanyName) => {
    if (formAssignedCo.includes(co)) {
      setFormAssignedCo(formAssignedCo.filter(c => c !== co));
    } else {
      setFormAssignedCo([...formAssignedCo, co]);
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formUsername.trim()) {
      setFormError("Username is required.");
      return;
    }

    if (users.some(u => u.username.toLowerCase() === formUsername.trim().toLowerCase())) {
      setFormError("Username already exists.");
      return;
    }

    const newUser = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      username: formUsername.trim(),
      email: formEmail.trim() || `${formUsername.toLowerCase()}@enterprise.in`,
      fullName: formFullName.trim() || formUsername.trim(),
      role: formRole,
      assignedCompanies: formRole === "Company Manager" ? formAssignedCo : undefined,
      companyName: formRole === "Employee" ? formAssignedCo[0] : undefined,
      mustChangePassword: true,
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      passwordHash: formPassword
    };

    const updated = [...users, newUser];
    saveRegisteredUsers(updated);
    setUsers(updated);

    logAuditEvent({
      user: currentUser?.username || "Admin",
      role: currentUser?.role || "Administrator",
      action: "User Account Created",
      module: "User Management",
      newValue: `${newUser.username} (${newUser.role})`,
      reason: "New authorized user registered"
    });

    setFeedback(`User '${newUser.username}' created successfully.`);
    setIsAddModalOpen(false);
  };

  const handleDeleteUser = (userId: string, username: string) => {
    if (username === "Admin") {
      alert("Primary Admin account cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete user account '${username}'?`)) return;

    const updated = users.filter(u => u.id !== userId);
    saveRegisteredUsers(updated);
    setUsers(updated);

    logAuditEvent({
      user: currentUser?.username || "Admin",
      role: currentUser?.role || "Administrator",
      action: "User Account Deleted",
      module: "User Management",
      recordIdentifier: userId,
      previousValue: username,
      reason: "User account removed"
    });
  };

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-5xl mx-auto">
      {/* Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-blue-600" />
            <span>User Accounts & Permissions</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Role-based access control for Administrators, Company Managers, and Employees
          </p>
        </div>

        <button
          onClick={() => {
            setFormUsername("");
            setFormEmail("");
            setFormFullName("");
            setFormRole("Company Manager");
            setFormAssignedCo(["HB"]);
            setFormPassword("User@1234");
            setFormError("");
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add System User</span>
        </button>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
              <th className="p-4 pl-6">Username</th>
              <th className="p-4">Full Name</th>
              <th className="p-4">Assigned Role</th>
              <th className="p-4">Company Scopes</th>
              <th className="p-4">Security Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/60 transition">
                <td className="p-4 pl-6 font-bold text-slate-900">{u.username}</td>
                <td className="p-4">{u.fullName}</td>
                <td className="p-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      u.role === "Administrator"
                        ? "bg-purple-100 text-purple-800"
                        : u.role === "Company Manager"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-xs font-semibold text-slate-600">
                  {u.role === "Administrator" ? (
                    <span className="text-emerald-600 font-bold">All 5 Companies</span>
                  ) : u.assignedCompanies ? (
                    u.assignedCompanies.join(", ")
                  ) : u.companyName ? (
                    u.companyName
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-4">
                  {u.mustChangePassword ? (
                    <span className="text-[10px] text-amber-600 font-bold">Password Reset Pending</span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-bold">Verified</span>
                  )}
                </td>
                <td className="p-4 pr-6 text-right">
                  {u.username !== "Admin" && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-left">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-base font-display text-white">Create System User</h3>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="e.g. Manager_TP"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="e.g. Abhijit Roy"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  User Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="Administrator">Administrator (Full Access)</option>
                  <option value="Company Manager">Company Manager (Assigned Companies)</option>
                  <option value="Employee">Employee (Self Roster Only)</option>
                </select>
              </div>

              {formRole !== "Administrator" && (
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Authorized Companies
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VALID_COMPANIES.map(co => (
                      <label key={co} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAssignedCo.includes(co)}
                          onChange={() => handleToggleCompany(co)}
                          className="rounded text-blue-600"
                        />
                        <span>{co}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Initial Password
                </label>
                <input
                  type="text"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
