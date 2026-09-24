/**
 * Indian Standard Time (Asia/Kolkata) Date & Time Utilities
 * Display formats:
 * - Date: DD-MM-YYYY
 * - Time: hh:mm:ss A
 * Storage format:
 * - YYYY-MM-DD HH:mm:ss
 */

// Format Date object to YYYY-MM-DD in local time
export function formatDateToISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Format Date object to YYYY-MM in local time
export function formatMonthToISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Robust ISO Date Key extractor: returns YYYY-MM-DD regardless of input format
export function extractDateKey(timestamp?: string): string {
  if (!timestamp) return "";
  const cleaned = timestamp.replace("T", " ").trim();
  const rawDate = cleaned.split(" ")[0] || "";

  // If already in YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // If in DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(rawDate)) {
    const [d, m, y] = rawDate.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // If in DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
    const [d, m, y] = rawDate.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // If in YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Fallback try Date parsing
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  } catch {}

  return rawDate;
}

// Convert any date or timestamp string to Indian Standard Date: DD-MM-YYYY
export function formatToIndianDate(dateStr?: string): string {
  if (!dateStr || dateStr === "—") return "—";
  const isoKey = extractDateKey(dateStr);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoKey)) {
    const [y, m, d] = isoKey.split("-");
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

// Parse timestamp string into 24-hour HH:mm:ss
export function extractTime24(timestamp?: string): string {
  if (!timestamp) return "";
  const cleaned = timestamp.replace("T", " ").trim();
  const parts = cleaned.split(" ");
  let timeChunk = "";
  
  if (parts.length > 1) {
    timeChunk = parts.slice(1).join(" ");
  } else if (cleaned.includes(":")) {
    timeChunk = cleaned;
  }

  if (!timeChunk) return "";

  // Check if AM/PM format (e.g. 09:30:00 AM or 9:30 AM)
  const isPM = timeChunk.toUpperCase().includes("PM");
  const isAM = timeChunk.toUpperCase().includes("AM");
  
  const rawNums = timeChunk.replace(/AM|PM|am|pm/g, "").trim();
  const chunks = rawNums.split(":");
  if (chunks.length >= 2) {
    let hours = parseInt(chunks[0], 10) || 0;
    const minutes = String(parseInt(chunks[1], 10) || 0).padStart(2, "0");
    const seconds = chunks[2] ? String(parseInt(chunks[2].split(".")[0], 10) || 0).padStart(2, "0") : "00";

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
  }

  return timeChunk.substring(0, 8);
}

// Convert any timestamp or time to Indian Standard 12-hour: hh:mm:ss A
export function formatToIndianTime(timestampOrTime?: string): string {
  if (!timestampOrTime || timestampOrTime === "—") return "—";
  
  const time24 = extractTime24(timestampOrTime);
  if (!time24 || !time24.includes(":")) return timestampOrTime;

  const chunks = time24.split(":");
  if (chunks.length >= 2) {
    let hours = parseInt(chunks[0], 10);
    const minutes = chunks[1].padStart(2, "0");
    const seconds = chunks[2] ? chunks[2].substring(0, 2).padStart(2, "0") : "00";
    if (isNaN(hours)) return timestampOrTime;

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const hourStr = String(hours).padStart(2, "0");
    return `${hourStr}:${minutes}:${seconds} ${ampm}`;
  }

  return timestampOrTime;
}

// Format full timestamp into Indian Standard display: DD-MM-YYYY hh:mm:ss A
export function formatToIndianDateTime(timestamp?: string): string {
  if (!timestamp || timestamp === "—") return "—";
  const datePart = formatToIndianDate(timestamp);
  const timePart = formatToIndianTime(timestamp);
  return `${datePart} ${timePart}`;
}

// Generate current timestamp in DB format YYYY-MM-DD HH:mm:ss (IST)
export function getCurrentISTDatabaseTimestamp(): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));

  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  const hh = String(ist.getHours()).padStart(2, "0");
  const mm = String(ist.getMinutes()).padStart(2, "0");
  const ss = String(ist.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

// Calculate work duration in hours and minutes between two times
export function calculateWorkingDuration(inTime?: string, outTime?: string): { text: string; minutes: number } {
  if (!inTime || inTime === "—" || !outTime || outTime === "—") {
    return { text: "—", minutes: 0 };
  }

  try {
    const in24 = extractTime24(inTime);
    const out24 = extractTime24(outTime);

    const [inH, inM] = in24.split(":").map(Number);
    const [outH, outM] = out24.split(":").map(Number);

    const inTotalMin = (inH || 0) * 60 + (inM || 0);
    const outTotalMin = (outH || 0) * 60 + (outM || 0);

    let diff = outTotalMin - inTotalMin;
    if (diff < 0) {
      // Overnight shift
      diff += 24 * 60;
    }

    if (diff <= 0) return { text: "0h 0m", minutes: 0 };
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return { text: `${hrs}h ${mins}m`, minutes: diff };
  } catch {
    return { text: "—", minutes: 0 };
  }
}

// Check if arrival time exceeds grace cutoff 09:30:00 AM
export function isLateArrival(timeStr?: string, cutoff: string = "09:30:00"): boolean {
  if (!timeStr || timeStr === "—") return false;
  const time24 = extractTime24(timeStr);
  if (!time24) return false;
  return time24 > cutoff;
}

// Get day of week name for a YYYY-MM-DD or DD-MM-YYYY date
export function getDayOfWeek(dateStr?: string): string {
  if (!dateStr || dateStr === "—") return "";
  const iso = extractDateKey(dateStr);
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dateObj = new Date(y, m - 1, d);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dateObj.getDay()] || "";
}
