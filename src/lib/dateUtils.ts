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

// Convert YYYY-MM-DD or full timestamp to DD-MM-YYYY
export function formatToIndianDate(dateStr?: string): string {
  if (!dateStr || dateStr === "—") return "—";
  const clean = dateStr.trim().split("T")[0].split(" ")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> DD-MM-YYYY
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY already
      return `${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}-${parts[2]}`;
    }
  }
  return dateStr;
}

// Parse timestamp string into YYYY-MM-DD date key
export function extractDateKey(timestamp?: string): string {
  if (!timestamp) return "";
  const cleaned = timestamp.replace("T", " ").trim();
  const parts = cleaned.split(" ");
  return parts[0] || "";
}

// Parse timestamp string into 24-hour HH:mm:ss
export function extractTime24(timestamp?: string): string {
  if (!timestamp) return "";
  const cleaned = timestamp.replace("T", " ").trim();
  const parts = cleaned.split(" ");
  if (parts.length > 1) {
    return parts[1].substring(0, 8);
  }
  return "";
}

// Convert 24-hour time HH:mm:ss to 12-hour hh:mm:ss A
export function formatToIndianTime(timestampOrTime?: string): string {
  if (!timestampOrTime || timestampOrTime === "—") return "—";
  
  let timePart = timestampOrTime.trim();
  if (timePart.includes(" ") && !timePart.includes("AM") && !timePart.includes("PM")) {
    timePart = timePart.split(" ")[1] || timePart;
  }
  if (timePart.includes("T")) {
    timePart = timePart.split("T")[1] || timePart;
  }
  
  // If already in AM/PM format
  if (timePart.toUpperCase().includes("AM") || timePart.toUpperCase().includes("PM")) {
    return timePart;
  }

  const chunks = timePart.split(":");
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

// Generate current timestamp in DB format YYYY-MM-DD HH:mm:ss
export function getCurrentISTDatabaseTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

// Calculate work duration in hours and minutes between two 24h or AM/PM times
export function calculateWorkingDuration(inTime?: string, outTime?: string): { text: string; minutes: number } {
  if (!inTime || inTime === "—" || !outTime || outTime === "—") {
    return { text: "—", minutes: 0 };
  }

  try {
    const parseToMinutes = (timeStr: string): number => {
      let t = timeStr.trim();
      if (t.includes(" ")) {
        const parts = t.split(" ");
        if (parts[1]?.toUpperCase() === "PM" || parts[1]?.toUpperCase() === "AM") {
          const [h, m] = parts[0].split(":").map(Number);
          let hours = h % 12;
          if (parts[1].toUpperCase() === "PM") hours += 12;
          return hours * 60 + m;
        }
      }
      const [h, m] = t.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const inMin = parseToMinutes(inTime);
    const outMin = parseToMinutes(outTime);

    let diff = outMin - inMin;
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

// Check if a punch in time is considered Late (after 09:30:00 AM)
export function isLateArrival(time24OrFormatted: string, graceThreshold: string = "09:30:00"): boolean {
  if (!time24OrFormatted || time24OrFormatted === "—") return false;
  let t24 = extractTime24(time24OrFormatted);
  if (!t24 && time24OrFormatted.includes(":")) {
    t24 = time24OrFormatted.substring(0, 8);
  }
  return t24 > graceThreshold;
}

// Get day of week name
export function getDayOfWeek(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dt.getDay()] || "—";
  } catch {
    return "—";
  }
}
