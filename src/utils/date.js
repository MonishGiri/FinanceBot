// ========================================
// Date Utility Module for Asia/Kolkata
// ========================================

const TIME_ZONE = "Asia/Kolkata";

// ========================================
// Format Date as YYYY-MM-DD
// ========================================

export function formatDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

// ========================================
// Get Current Date Parts in Asia/Kolkata
// ========================================

export function getKolkataDateParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year").value);
  const month = Number(parts.find((p) => p.type === "month").value);
  const day = Number(parts.find((p) => p.type === "day").value);
  const weekday = parts.find((p) => p.type === "weekday").value.toLowerCase();

  return { year, month, day, weekday };
}

// ========================================
// Get Today
// ========================================

export function getToday() {
  return formatDate(new Date());
}

// ========================================
// Get Date With Offset (in days)
// ========================================

export function getDateWithOffset(days) {
  const { year, month, day } = getKolkataDateParts();
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

// ========================================
// Yesterday
// ========================================

export function getYesterday() {
  return getDateWithOffset(-1);
}

// ========================================
// Days Ago Range (e.g. 2 days ago)
// ========================================

export function getDaysAgoRange(daysAgo) {
  const targetDate = getDateWithOffset(-Math.abs(daysAgo));
  return {
    startDate: targetDate,
    endDate: targetDate,
  };
}

// ========================================
// Last N Days Range (e.g. last 7 days)
// ========================================

export function getLastNDaysRange(n = 7) {
  const today = getToday();
  const startDate = getDateWithOffset(-(Math.abs(n) - 1));
  return {
    startDate,
    endDate: today,
  };
}

// ========================================
// This Month
// ========================================

export function getMonthRange() {
  const today = getToday();
  const [year, month] = today.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return {
    startDate,
    endDate,
  };
}

// ========================================
// Last Month
// ========================================

export function getLastMonthRange() {
  const today = getToday();
  const [year, month] = today.split("-").map(Number);

  const lastMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const lastMonthYear = lastMonthDate.getUTCFullYear();
  const lastMonth = lastMonthDate.getUTCMonth() + 1;

  const startDate = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(lastMonthYear, lastMonth, 0)).getUTCDate();
  const endDate = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return {
    startDate,
    endDate,
  };
}

// ========================================
// This Week (Monday → Sunday)
// ========================================

export function getWeekRange() {
  const today = getToday();
  const [year, month, day] = today.split("-").map(Number);
  const currentDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = currentDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const startDateObject = new Date(currentDate);
  startDateObject.setUTCDate(startDateObject.getUTCDate() - daysSinceMonday);

  const endDateObject = new Date(startDateObject);
  endDateObject.setUTCDate(endDateObject.getUTCDate() + 6);

  return {
    startDate: startDateObject.toISOString().split("T")[0],
    endDate: endDateObject.toISOString().split("T")[0],
  };
}

// ========================================
// Last Week (Monday → Sunday)
// ========================================

export function getLastWeekRange() {
  const thisWeek = getWeekRange();

  const startDateObject = new Date(`${thisWeek.startDate}T00:00:00Z`);
  const endDateObject = new Date(`${thisWeek.endDate}T00:00:00Z`);

  startDateObject.setUTCDate(startDateObject.getUTCDate() - 7);
  endDateObject.setUTCDate(endDateObject.getUTCDate() - 7);

  return {
    startDate: startDateObject.toISOString().split("T")[0],
    endDate: endDateObject.toISOString().split("T")[0],
  };
}

// ========================================
// Weekday Support (Most Recent Occurrence)
// ========================================

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Returns a date range for the most recent occurrence of a given weekday in Asia/Kolkata.
 * If today is Monday and user asks for Monday, returns today.
 * @param {string} weekdayName
 * @returns {{ startDate: string, endDate: string }}
 */
export function getMostRecentWeekdayRange(weekdayName) {
  const normalized = (weekdayName || "").toLowerCase().trim();
  const targetDay = WEEKDAYS[normalized];

  if (targetDay === undefined) {
    const today = getToday();
    return { startDate: today, endDate: today };
  }

  const { year, month, day } = getKolkataDateParts();
  const currentUtcDate = new Date(Date.UTC(year, month - 1, day));
  const currentDay = currentUtcDate.getUTCDay();

  let daysBack = (currentDay - targetDay + 7) % 7;
  // If user asks about current weekday, daysBack is 0 (today)
  const targetUtcDate = new Date(currentUtcDate);
  targetUtcDate.setUTCDate(targetUtcDate.getUTCDate() - daysBack);

  const formatted = targetUtcDate.toISOString().split("T")[0];
  return {
    startDate: formatted,
    endDate: formatted,
  };
}

// ========================================
// Day Range (Single Date)
// ========================================

export function getDayRange(dateString) {
  return {
    startDate: dateString,
    endDate: dateString,
  };
}

// ========================================
// Custom Date Range
// ========================================

export function getCustomDateRange(startStr, endStr) {
  let startDate = startStr;
  let endDate = endStr;

  if (startDate && endDate && startDate > endDate) {
    // Swap if reversed
    const temp = startDate;
    startDate = endDate;
    endDate = temp;
  }

  return {
    startDate: startDate || getToday(),
    endDate: endDate || startDate || getToday(),
  };
}

// ========================================
// Preset / Legacy Date Range
// ========================================

export function getDateRange(period) {
  switch (period) {
    case "today": {
      const today = getToday();
      return { startDate: today, endDate: today };
    }
    case "yesterday": {
      const yesterday = getYesterday();
      return { startDate: yesterday, endDate: yesterday };
    }
    case "this_week":
      return getWeekRange();
    case "last_week":
      return getLastWeekRange();
    case "this_month":
      return getMonthRange();
    case "last_month":
      return getLastMonthRange();
    default:
      return getMonthRange();
  }
}

// ========================================
// Unified Date Range Resolver for Queries
// ========================================

/**
 * Resolves structured query parameters into an exact start and end date in Asia/Kolkata.
 * @param {object} query
 * @returns {{ startDate: string, endDate: string }}
 */
export function resolveQueryDateRange(query) {
  if (!query) return getMonthRange();

  // If explicit startDate and endDate provided
  if (query.startDate && query.endDate) {
    return getCustomDateRange(query.startDate, query.endDate);
  }

  // Handle dateType classifications
  switch (query.dateType) {
    case "last_n_days":
      return getLastNDaysRange(query.days || 7);

    case "day_of_week":
      return getMostRecentWeekdayRange(query.dayOfWeek);

    case "days_ago":
      return getDaysAgoRange(query.days || 1);

    case "exact_date":
      return getDayRange(query.exactDate || getToday());

    case "date_range":
      return getCustomDateRange(query.startDate, query.endDate);

    case "preset":
      return getDateRange(query.period);

    default:
      if (query.period) {
        return getDateRange(query.period);
      }
      return getMonthRange();
  }
}

// ========================================
// Display Formatting
// ========================================

export function formatDisplayDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDisplayDateRange(startDate, endDate) {
  if (!startDate) return "";
  if (!endDate || startDate === endDate) {
    return formatDisplayDate(startDate);
  }
  return `${formatDisplayDate(startDate)} → ${formatDisplayDate(endDate)}`;
}