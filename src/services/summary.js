// ========================================
// Summary Calculation Services
// ========================================

/**
 * Basic summary calculation for backwards compatibility.
 * @param {Array} transactions
 * @returns {{ totalIncome: number, totalExpenses: number, balance: number, categoryTotals: Record<string, number> }}
 */
export function calculateSummary(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals = {};

  for (const transaction of transactions) {
    const amount = Number(transaction.amount) || 0;

    if (transaction.type === "income") {
      totalIncome += amount;
    } else if (transaction.type === "expense") {
      totalExpenses += amount;
      const category = transaction.category || "Other";
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    }
  }

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    categoryTotals,
  };
}

/**
 * Detailed summary calculation (Phase 2 requirement).
 * Returns totals, balance, category breakdowns, top spending category, largest expense, and transaction count.
 * @param {Array} transactions
 * @returns {{
 *   totalIncome: number,
 *   totalExpenses: number,
 *   balance: number,
 *   categoryTotals: Record<string, number>,
 *   topCategory: { category: string, amount: number } | null,
 *   largestExpense: object | null,
 *   transactionCount: number
 * }}
 */
export function calculateDetailedSummary(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals = {};
  let largestExpense = null;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount) || 0;

    if (transaction.type === "income") {
      totalIncome += amount;
    } else if (transaction.type === "expense") {
      totalExpenses += amount;
      const category = transaction.category || "Other";
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;

      if (!largestExpense || amount > Number(largestExpense.amount)) {
        largestExpense = transaction;
      }
    }
  }

  // Find top spending category
  let topCategory = null;
  let highestAmount = 0;
  for (const [category, amount] of Object.entries(categoryTotals)) {
    if (amount > highestAmount) {
      highestAmount = amount;
      topCategory = { category, amount };
    }
  }

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    categoryTotals,
    topCategory,
    largestExpense,
    transactionCount: transactions.length,
  };
}