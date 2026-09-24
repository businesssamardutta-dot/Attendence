import { CompanyName, UserProfile, UserRole, VALID_COMPANIES } from "../types";
import { logAuditEvent } from "./auditStore";

const AUTH_STORAGE_KEY = "attendance_auth_user";
const USERS_LIST_KEY = "attendance_registered_users";

// Default Initial Users
const DEFAULT_USERS: (UserProfile & { passwordHash: string })[] = [
  {
    id: "USR-001",
    username: "Admin",
    email: "admin@enterprise.in",
    fullName: "Chief System Administrator",
    role: "Administrator",
    mustChangePassword: true, // Enforces first-time password change
    createdAt: "2026-04-01 00:00:00",
    passwordHash: "Admin@1234"
  },
  {
    id: "USR-002",
    username: "Manager_HB",
    email: "manager.hb@enterprise.in",
    fullName: "HB Operations Manager",
    role: "Company Manager",
    assignedCompanies: ["HB", "HB-TP", "HBPL"],
    mustChangePassword: false,
    createdAt: "2026-05-01 10:00:00",
    passwordHash: "Manager@1234"
  },
  {
    id: "USR-003",
    username: "Sneha_HB",
    email: "sneha.m@enterprise.in",
    fullName: "Sneha Mojumder",
    role: "Employee",
    companyName: "HB",
    employeeName: "Sneha Mojumder",
    mustChangePassword: false,
    createdAt: "2026-05-15 09:00:00",
    passwordHash: "Employee@1234"
  }
];

export function initializeDefaultAdmin() {
  getRegisteredUsers();
}

export function getRegisteredUsers(): (UserProfile & { passwordHash: string })[] {
  try {
    const raw = localStorage.getItem(USERS_LIST_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading users:", e);
  }
  try {
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(DEFAULT_USERS));
  } catch {}
  return DEFAULT_USERS;
}

export function saveRegisteredUsers(users: (UserProfile & { passwordHash: string })[]) {
  try {
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Error saving users:", e);
  }
}

export function getCurrentUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading current user session:", e);
  }
  return null;
}

export function setCurrentUser(user: UserProfile | null) {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.error("Error setting user session:", e);
  }
}

export function authenticateUser(username: string, password: string): { success: boolean; user?: UserProfile; message?: string } {
  const users = getRegisteredUsers();
  const trimmedUser = username.trim().toLowerCase();
  
  const found = users.find(
    u => u.username.toLowerCase() === trimmedUser || (u.email && u.email.toLowerCase() === trimmedUser)
  );

  if (!found) {
    logAuditEvent({
      user: username,
      role: "Administrator",
      action: "Failed Login Attempt",
      module: "Authentication",
      reason: `Unknown user account '${username}'.`
    });
    return { success: false, message: "Invalid credentials. Please verify your username and password." };
  }

  if (found.passwordHash !== password) {
    logAuditEvent({
      user: found.username,
      role: found.role,
      action: "Failed Login Attempt",
      module: "Authentication",
      reason: "Incorrect password entered."
    });
    return { success: false, message: "Incorrect password. Please try again." };
  }

  const userProfile: UserProfile = {
    id: found.id,
    username: found.username,
    email: found.email,
    fullName: found.fullName,
    role: found.role,
    assignedCompanies: found.assignedCompanies,
    companyName: found.companyName,
    employeeName: found.employeeName,
    mustChangePassword: found.mustChangePassword,
    createdAt: found.createdAt
  };

  setCurrentUser(userProfile);

  logAuditEvent({
    user: found.username,
    role: found.role,
    action: "User Login",
    module: "Authentication",
    reason: `Logged in with role '${found.role}'.`
  });

  return { success: true, user: userProfile };
}

export function updatePassword(userId: string, oldPass: string, newPass: string): { success: boolean; message: string } {
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) {
    return { success: false, message: "User account not found." };
  }

  if (users[idx].passwordHash !== oldPass && users[idx].mustChangePassword !== true) {
    return { success: false, message: "Current password is incorrect." };
  }

  if (newPass.length < 6) {
    return { success: false, message: "New password must be at least 6 characters long." };
  }

  users[idx].passwordHash = newPass;
  users[idx].mustChangePassword = false;
  saveRegisteredUsers(users);

  // Update current session
  const current = getCurrentUser();
  if (current && current.id === userId) {
    current.mustChangePassword = false;
    setCurrentUser(current);
  }

  logAuditEvent({
    user: users[idx].username,
    role: users[idx].role,
    action: "Password Changed",
    module: "Authentication",
    reason: "User updated their account credentials."
  });

  return { success: true, message: "Password updated successfully!" };
}

export function logoutUser() {
  const user = getCurrentUser();
  if (user) {
    logAuditEvent({
      user: user.username,
      role: user.role,
      action: "User Logout",
      module: "Authentication",
      reason: "Manual session logout."
    });
  }
  setCurrentUser(null);
}

// Permission Helpers
export function canAccessCompany(user: UserProfile | null, company: CompanyName): boolean {
  if (!user) return false;
  if (user.role === "Administrator") return true;
  if (user.role === "Company Manager") {
    return (user.assignedCompanies || []).includes(company);
  }
  if (user.role === "Employee") {
    return user.companyName === company;
  }
  return false;
}

export function canManageEmployees(user: UserProfile | null): boolean {
  if (!user) return false;
  return user.role === "Administrator" || user.role === "Company Manager";
}

export function canEditAttendance(user: UserProfile | null): boolean {
  if (!user) return false;
  return user.role === "Administrator" || user.role === "Company Manager";
}

export function canDeleteAttendance(user: UserProfile | null): boolean {
  if (!user) return false;
  return user.role === "Administrator";
}

export function canManageUsers(user: UserProfile | null): boolean {
  if (!user) return false;
  return user.role === "Administrator";
}

export function canExecuteMaintenance(user: UserProfile | null): boolean {
  if (!user) return false;
  return user.role === "Administrator";
}
