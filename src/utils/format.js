import { formatDisplayDate } from "./date.js";

// ========================================
// Category Emojis Mapping
// ========================================

export const CATEGORY_EMOJIS = {
  Food: "🍔",
  Transport: "🚕",
  Shopping: "🛍",
  Bills: "📱",
  Entertainment: "🎬",
  Health: "💊",
  Education: "📚",
  Travel: "✈️",
  Rent: "🏠",
  Subscriptions: "🔄",
  Salary: "💼",
  Freelance: "💻",
  Investment: "📈",
  Other: "📦",
};

export function getCategoryEmoji(category) {
  return CATEGORY_EMOJIS[category] || "📦";
}

// ========================================
// Currency Formatter
// ========================================

/**
 * Formats a numeric amount with Indian Rupee symbol and Indian numbering format.
 * Omits decimals for whole numbers (e.g. ₹500), retains two decimals for fractional amounts (e.g. ₹500.50).
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  const isWhole = num % 1 === 0;

  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  });

  return `₹${formatted}`;
}

// ========================================
// Format Single Transaction
// ========================================

export function formatTransaction(transaction) {
  const icon = transaction.type === "expense" ? "💸" : "💰";
  const amountStr = formatCurrency(transaction.amount);
  const categoryStr = transaction.category || "Other";
  const descStr = transaction.description ? transaction.description : "No description";

  return `${icon} ${amountStr}\n${categoryStr}\n${descStr}`;
}

// ========================================
// Group Transactions by Date
// ========================================

/**
 * Groups an array of transactions by transaction_date (descending).
 * @param {Array} transactions
 * @returns {Array<{ date: string, items: Array }>}
 */
export function groupTransactionsByDate(transactions) {
  const groups = new Map();

  for (const tx of transactions) {
    const date = tx.transaction_date;
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date).push(tx);
  }

  // Sort descending by date
  const sortedDates = Array.from(groups.keys()).sort((a, b) => (b > a ? 1 : -1));

  return sortedDates.map((date) => ({
    date,
    items: groups.get(date),
  }));
}

// ========================================
// Format Grouped Transactions List
// ========================================

export function formatTransactionList(transactions, dateRangeLabel = "") {
  if (!transactions || transactions.length === 0) {
    return "📭 You don't have any transactions for this period.";
  }

  const grouped = groupTransactionsByDate(transactions);

  let message = `📋 Transactions\n\n`;
  if (dateRangeLabel) {
    message += `📅 ${dateRangeLabel}\n\n`;
  }

  const groupBlocks = grouped.map((group) => {
    let block = `📅 ${formatDisplayDate(group.date)}\n\n`;
    block += group.items.map((tx) => formatTransaction(tx)).join("\n\n");
    return block;
  });

  message += groupBlocks.join("\n\n━━━━━━━━━━━━━━\n\n");
  return message;
}

// ========================================
// Format Detailed Financial Report (Phase 2)
// ========================================

export function formatFinancialReport(detailedSummaryOrOptions, dateLabelParam) {
  let detailedSummary = detailedSummaryOrOptions;
  let dateLabel = dateLabelParam;

  if (detailedSummaryOrOptions && detailedSummaryOrOptions.summary) {
    detailedSummary = detailedSummaryOrOptions.summary;
    dateLabel = dateLabelParam || detailedSummaryOrOptions.dateLabel || detailedSummaryOrOptions.title || "";
  }

  let message = `📊 Finance Report\n\n`;
  if (dateLabel) {
    message += `📅 ${dateLabel}\n\n`;
  }
  message += `━━━━━━━━━━━━━━\n\n`;

  message += `💰 Income\n${formatCurrency(detailedSummary.totalIncome)}\n\n`;
  message += `💸 Expenses\n${formatCurrency(detailedSummary.totalExpenses)}\n\n`;
  message += `💵 Balance\n${formatCurrency(detailedSummary.balance)}\n\n`;

  if (detailedSummary.topCategory) {
    message += `📂 Top Spending Category\n${detailedSummary.topCategory.category} — ${formatCurrency(detailedSummary.topCategory.amount)}\n\n`;
  } else {
    message += `📂 Top Spending Category\nNone\n\n`;
  }

  if (detailedSummary.largestExpense) {
    const cat = detailedSummary.largestExpense.category || "Other";
    const desc = detailedSummary.largestExpense.description || "No description";
    message += `🔻 Largest Expense\n${formatCurrency(detailedSummary.largestExpense.amount)} — ${cat}\nDescription: ${desc}\n\n`;
  } else {
    message += `🔻 Largest Expense\nNone\n\n`;
  }

  message += `🧾 Transactions\n${detailedSummary.transactionCount}`;

  return message;
}

// ========================================
// Format Financial Dashboard (Phase 7)
// ========================================

export function formatFinancialDashboard(detailedSummary, dateLabel) {
  let message = `📊 Financial Dashboard\n\n`;
  message += `📅 ${dateLabel}\n\n`;
  message += `━━━━━━━━━━━━━━━━\n\n`;

  message += `💰 Income\n${formatCurrency(detailedSummary.totalIncome)}\n\n`;
  message += `💸 Expenses\n${formatCurrency(detailedSummary.totalExpenses)}\n\n`;
  message += `💵 Balance\n${formatCurrency(detailedSummary.balance)}\n\n`;

  message += `━━━━━━━━━━━━━━━━\n\n`;
  message += `📂 Spending Breakdown\n\n`;

  const categoryEntries = Object.entries(detailedSummary.categoryTotals).sort((a, b) => b[1] - a[1]);

  if (categoryEntries.length === 0) {
    message += `No expense breakdown available.\n\n`;
  } else {
    for (const [category, amount] of categoryEntries) {
      const emoji = getCategoryEmoji(category);
      message += `${emoji} ${category}\n${formatCurrency(amount)}\n\n`;
    }
  }

  message += `━━━━━━━━━━━━━━━━\n\n`;

  if (detailedSummary.largestExpense) {
    const cat = detailedSummary.largestExpense.category || "Other";
    const desc = detailedSummary.largestExpense.description || "No description";
    message += `🔻 Largest Expense\n\n${formatCurrency(detailedSummary.largestExpense.amount)}\n${cat}\n${desc}\n\n`;
  } else {
    message += `🔻 Largest Expense\n\nNone\n\n`;
  }

  message += `━━━━━━━━━━━━━━━━\n\n`;

  if (detailedSummary.topCategory) {
    message += `🏆 Top Category\n\n${detailedSummary.topCategory.category} — ${formatCurrency(detailedSummary.topCategory.amount)}\n\n`;
  } else {
    message += `🏆 Top Category\n\nNone\n\n`;
  }

  message += `━━━━━━━━━━━━━━━━\n\n`;
  message += `🧾 Transactions\n\n${detailedSummary.transactionCount}`;

  return message;
}

// ========================================
// Split Long Message (Telegram 4096 Safe)
// ========================================

/**
 * Splits a long string into chunks under maxLength (default 4000)
 * splitting safely at separator lines or double newlines.
 */
export function splitMessage(text, maxLength = 4000) {
  if (!text || text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Attempt to split at section boundary "━━━━━━━━━━━━━━"
    let splitIdx = remaining.lastIndexOf("\n\n━━━━━━━━━━━━━━\n\n", maxLength);
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      // Try double newline
      splitIdx = remaining.lastIndexOf("\n\n", maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      // Try single newline
      splitIdx = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitIdx === -1) {
      // Fallback: hard cut
      splitIdx = maxLength;
    }

    const chunk = remaining.slice(0, splitIdx).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks;
}
