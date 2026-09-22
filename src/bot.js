import http from "node:http";
import "dotenv/config";
import { Bot, Keyboard } from "grammy";

import {
  classifyFinanceIntent,
  analyzeFinanceMessage,
  analyzeFinanceQuery,
  analyzeBudgetIntent,
  analyzeRecurringIntent,
} from "./services/ai.js";

import {
  addTransaction,
  getTransactionsByDate,
  getTransactionsByMonth,
  queryTransactions,
  getCategorySpending,
} from "./services/transaction.js";

import {
  calculateSummary,
  calculateDetailedSummary,
} from "./services/summary.js";

import {
  setBudget,
  getBudget,
  getUserBudgets,
  calculateBudgetStatus,
  formatBudgetStatus,
  formatAllBudgets,
} from "./services/budget.js";

import {
  addRecurringExpense,
  getUserRecurringExpenses,
  removeRecurringExpense,
  formatRecurringExpensesList,
} from "./services/recurring.js";

import {
  getToday,
  getMonthRange,
  getDateRange,
  resolveQueryDateRange,
  formatDisplayDate,
  formatDisplayDateRange,
} from "./utils/date.js";

import {
  formatCurrency,
  formatTransaction,
  formatTransactionList,
  formatFinancialReport,
  formatFinancialDashboard,
  splitMessage,
} from "./utils/format.js";

// ========================================
// Environment Variables & Sanitization
// ========================================

const rawToken = process.env.TELEGRAM_BOT_TOKEN;

if (!rawToken || rawToken.trim() === "" || rawToken.includes("your_telegram_bot_token")) {
  console.error("❌ ERROR: TELEGRAM_BOT_TOKEN is missing or not set properly in environment variables!");
  console.error("👉 Please go to your Render Dashboard -> Environment and add TELEGRAM_BOT_TOKEN.");
  throw new Error("TELEGRAM_BOT_TOKEN is missing or invalid.");
}

// Clean token: strip surrounding quotes and extra whitespace often introduced when copy-pasting in cloud UIs
const token = rawToken.trim().replace(/^["']|["']$/g, "").trim();

if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
  console.warn("⚠️ WARNING: TELEGRAM_BOT_TOKEN format looks suspicious.");
  console.warn(`Expected format like: 123456789:ABCdefGHI...`);
  console.warn(`Token starts with: "${token.slice(0, 10)}..." (length: ${token.length})`);
  console.warn("If you see quotes or invalid characters, check your Render Environment Variables.");
}

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from environment variables.");
}

// ========================================
// Lightweight HTTP Server (For Render Web Service)
// ========================================

// Render Web Services expect an open port; this keeps the free tier service healthy
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", bot: "FinanceBot", timestamp: new Date().toISOString() }));
});

server.listen(port, () => {
  console.log(`🌐 Health check server listening on port ${port}`);
});

// ========================================
// Create Telegram Bot
// ========================================

const bot = new Bot(token);

// ========================================
// Telegram Shortcut Keyboard
// ========================================

const mainKeyboard = new Keyboard()
  .text("📊 Today")
  .text("📅 This Month")
  .row()
  .text("💸 Today's Expenses")
  .text("📋 Transactions")
  .row()
  .text("📈 Dashboard")
  .resized()
  .persistent();

// ========================================
// Helper: Send Long Message Safely
// ========================================

/**
 * Splits a long text message into safe chunks (<= 4000 characters)
 * to respect Telegram's message length limits without truncating transactions.
 */
async function sendLongMessage(ctx, text, replyMarkup = mainKeyboard) {
  const chunks = splitMessage(text, 4000);
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    await ctx.reply(chunks[i], {
      reply_markup: isLast ? replyMarkup : undefined,
    });
  }
}

// ========================================
// /start Command
// ========================================

bot.command("start", async (ctx) => {
  await ctx.reply(
    `👋 Welcome to AI Finance Assistant!

I can help you track, analyze, and manage your finances with ease.

💰 Add Transactions:
• "I spent ₹500 on dinner"
• "I earned ₹50,000 salary"
• "I paid ₹2,000 for electricity"

📊 Natural Language Questions:
• "How much did I spend this month?"
• "What was my biggest expense?"
• "Show my expenses for the last 7 days"
• "What did I spend on Monday?"
• "How much did I spend from 1 September to 15 September?"

🎯 Budgets:
• "Set my food budget to ₹5,000"
• "How much of my food budget is left?"
• "Am I over my food budget?"

🔄 Recurring Expenses:
• "Set my Netflix subscription to ₹649 monthly"
• "Show my recurring expenses"
• "Remove my Netflix recurring expense"

📈 Reports & Dashboard:
• "Financial dashboard"
• "Finance report"

Or tap the shortcuts below 👇`,
    {
      reply_markup: mainKeyboard,
    }
  );
});

// ========================================
// /help Command
// ========================================

bot.command("help", async (ctx) => {
  await ctx.reply(
    `🤖 AI Finance Assistant — Help Guide

💸 Add Expenses & Income:
• "I spent ₹500 on groceries"
• "I received ₹10,000 freelance payment"
• "Paid 250 for uber"

📊 Summaries & Queries:
• "How much did I spend today / yesterday / this month?"
• "What was my biggest expense this month?"
• "Show my spending from 10 September to 20 September"
• "How much did I spend on Monday?"
• "Show my expenses for the last 7 days"

🎯 Budget Tracking:
• "Set my shopping budget to ₹10,000"
• "How much of my shopping budget is left?"
• "Show my budgets"

🔄 Recurring Expenses:
• "Add recurring rent of ₹20,000"
• "Set my Netflix subscription to ₹649 monthly"
• "Show my recurring expenses"
• "Remove my Netflix recurring expense"

📈 Reports:
• "Financial dashboard"
• "Monthly summary"

You can also use the quick shortcut buttons below 👇`,
    {
      reply_markup: mainKeyboard,
    }
  );
});

// ========================================
// TODAY SUMMARY (Phase 2 Enhanced)
// ========================================

async function sendTodaySummary(ctx) {
  try {
    const userId = ctx.from.id;
    const today = getToday();

    const transactions = await getTransactionsByDate(userId, today);

    if (transactions.length === 0) {
      await ctx.reply("📭 You have no transactions for today.", {
        reply_markup: mainKeyboard,
      });
      return;
    }

    const detailed = calculateDetailedSummary(transactions);
    const dateLabel = formatDisplayDate(today);
    const report = formatFinancialReport(detailed, dateLabel);

    await sendLongMessage(ctx, report);
  } catch (error) {
    console.error("Today summary error:", error);
    await ctx.reply("Something went wrong while getting today's summary. Please try again.", {
      reply_markup: mainKeyboard,
    });
  }
}

// ========================================
// MONTH SUMMARY (Phase 2 Enhanced)
// ========================================

async function sendMonthSummary(ctx) {
  try {
    const userId = ctx.from.id;
    const { startDate, endDate } = getMonthRange();

    const transactions = await getTransactionsByMonth(userId, startDate, endDate);

    if (transactions.length === 0) {
      await ctx.reply("📭 You have no transactions for this month.", {
        reply_markup: mainKeyboard,
      });
      return;
    }

    const detailed = calculateDetailedSummary(transactions);
    const dateLabel = formatDisplayDateRange(startDate, endDate);
    const report = formatFinancialReport(detailed, dateLabel);

    await sendLongMessage(ctx, report);
  } catch (error) {
    console.error("Monthly summary error:", error);
    await ctx.reply("Something went wrong while getting your monthly summary. Please try again.", {
      reply_markup: mainKeyboard,
    });
  }
}

// ========================================
// TODAY'S EXPENSES (Phase 3 Enhanced)
// ========================================

async function sendTodayExpenses(ctx) {
  try {
    const userId = ctx.from.id;
    const today = getToday();

    const transactions = await getTransactionsByDate(userId, today);
    const expenses = transactions.filter((tx) => tx.type === "expense");

    if (expenses.length === 0) {
      await ctx.reply("📭 You have no expenses today.", {
        reply_markup: mainKeyboard,
      });
      return;
    }

    let message = `💸 Today's Expenses\n\n`;
    message += `📅 ${formatDisplayDate(today)}\n\n`;

    let total = 0;
    for (const tx of expenses) {
      const amount = Number(tx.amount);
      total += amount;
      message += `• ${formatCurrency(amount)} - ${tx.category} - ${tx.description || "No description"}\n`;
    }

    message += `\n━━━━━━━━━━━━━━\n`;
    message += `💸 Total: ${formatCurrency(total)}`;

    await sendLongMessage(ctx, message);
  } catch (error) {
    console.error("Today's expenses error:", error);
    await ctx.reply("Something went wrong while getting today's expenses. Please try again.", {
      reply_markup: mainKeyboard,
    });
  }
}

// ========================================
// THIS MONTH'S TRANSACTIONS (Phase 3 Enhanced)
// ========================================

async function sendTransactions(ctx) {
  try {
    const userId = ctx.from.id;
    const { startDate, endDate } = getMonthRange();

    const transactions = await queryTransactions(userId, startDate, endDate);

    if (transactions.length === 0) {
      await ctx.reply("📭 You don't have any transactions this month.", {
        reply_markup: mainKeyboard,
      });
      return;
    }

    const dateLabel = formatDisplayDateRange(startDate, endDate);
    const formatted = formatTransactionList(transactions, dateLabel);

    await sendLongMessage(ctx, formatted);
  } catch (error) {
    console.error("Transactions error:", error);
    await ctx.reply("Something went wrong while getting your transactions. Please try again.", {
      reply_markup: mainKeyboard,
    });
  }
}

// ========================================
// FINANCIAL DASHBOARD (Phase 7)
// ========================================

async function sendDashboard(ctx, startDate = null, endDate = null) {
  try {
    const userId = ctx.from.id;
    const range = (startDate && endDate) ? { startDate, endDate } : getMonthRange();

    const transactions = await queryTransactions(userId, range.startDate, range.endDate);

    if (transactions.length === 0) {
      await ctx.reply("📭 You have no transactions to generate a dashboard for this period.", {
        reply_markup: mainKeyboard,
      });
      return;
    }

    const detailed = calculateDetailedSummary(transactions);
    const dateLabel = formatDisplayDateRange(range.startDate, range.endDate);
    const dashboardText = formatFinancialDashboard(detailed, dateLabel);

    await sendLongMessage(ctx, dashboardText);
  } catch (error) {
    console.error("Dashboard error:", error);
    await ctx.reply("Something went wrong while generating the financial dashboard. Please try again.", {
      reply_markup: mainKeyboard,
    });
  }
}

// ========================================
// Telegram Shortcut Button Handlers
// ========================================

bot.hears("📊 Today", async (ctx) => {
  await sendTodaySummary(ctx);
});

bot.hears("📅 This Month", async (ctx) => {
  await sendMonthSummary(ctx);
});

bot.hears("💸 Today's Expenses", async (ctx) => {
  await sendTodayExpenses(ctx);
});

bot.hears("📋 Transactions", async (ctx) => {
  await sendTransactions(ctx);
});

bot.hears(["📈 Dashboard", "📊 Dashboard", "Dashboard"], async (ctx) => {
  await sendDashboard(ctx);
});

// ========================================
// Command Handlers
// ========================================

bot.command("today", async (ctx) => {
  await sendTodaySummary(ctx);
});

bot.command("month", async (ctx) => {
  await sendMonthSummary(ctx);
});

bot.command("transactions", async (ctx) => {
  await sendTransactions(ctx);
});

bot.command("dashboard", async (ctx) => {
  await sendDashboard(ctx);
});

// ========================================
// Handler: Add Transaction (Phase 1 & 5 Warning)
// ========================================

async function handleAddTransaction(ctx, message) {
  try {
    const transaction = await analyzeFinanceMessage(message);
    console.log("Parsed transaction:", transaction);

    // Validate Type
    if (transaction.type !== "expense" && transaction.type !== "income") {
      await ctx.reply("I couldn't determine whether this is an income or expense. Please specify, e.g. \"I spent ₹500 on dinner\" or \"I earned ₹50,000 salary\".", {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // Validate Amount
    if (!transaction.amount || Number(transaction.amount) <= 0) {
      await ctx.reply("I couldn't determine the amount. Please include a valid amount, e.g. \"I spent ₹500 on dinner\".", {
        reply_markup: mainKeyboard,
      });
      return;
    }

    const userId = ctx.from.id;

    // Save Transaction to Supabase
    const saved = await addTransaction(userId, transaction);
    console.log("Saved transaction:", saved);

    // Build Success Response
    const isExpense = transaction.type === "expense";
    const typeLabel = isExpense ? "Expense" : "Income";

    let reply = `✅ ${typeLabel} added!\n\n`;
    reply += `💰 Amount: ${formatCurrency(transaction.amount)}\n`;
    reply += `📂 Category: ${transaction.category || "Other"}\n`;
    reply += `📝 Description: ${transaction.description || "No description"}\n`;
    reply += `📅 Date: ${formatDisplayDate(transaction.date)}`;

    // Budget Notification Check for Expenses
    if (isExpense && transaction.category) {
      try {
        const budget = await getBudget(userId, transaction.category, "monthly");
        if (budget) {
          const { startDate, endDate } = getMonthRange();
          const totalSpent = await getCategorySpending(userId, transaction.category, startDate, endDate);
          const status = calculateBudgetStatus(budget, totalSpent);

          if (status.isExceeded) {
            reply += `\n\n🚨 Alert: You have exceeded your ${transaction.category} budget of ${formatCurrency(budget.amount)}! (Total spent: ${formatCurrency(totalSpent)}, ${status.percentage}%)`;
          } else if (status.isApproaching) {
            reply += `\n\n⚠️ Warning: You have used ${status.percentage}% of your ${transaction.category} budget (${formatCurrency(totalSpent)} / ${formatCurrency(budget.amount)}). Remaining: ${formatCurrency(status.remaining)}`;
          }
        }
      } catch (err) {
        // Log budget check failure quietly so transaction recording is never blocked
        console.warn("Budget alert check warning:", err.message);
      }
    }

    await ctx.reply(reply, {
      reply_markup: mainKeyboard,
    });
  } catch (error) {
    console.error("Add transaction error:", error);
    await ctx.reply("Something went wrong while processing your transaction. Please try again.", {
      reply_markup: mainKeyboard,
    });
  }
}

// ========================================
// Handler: Finance Queries (Phase 2, 3, 4, 7)
// ========================================

async function handleFinanceQuery(ctx, message) {
  try {
    const query = await analyzeFinanceQuery(message);
    console.log("Parsed finance query:", query);

    // Resolve date range using Asia/Kolkata JavaScript date utility (Phase 4)
    const { startDate, endDate } = resolveQueryDateRange(query);
    console.log("Resolved date range:", startDate, "→", endDate);

    const userId = ctx.from.id;
    const transactions = await queryTransactions(
      userId,
      startDate,
      endDate,
      query.category
    );

    const dateLabel = formatDisplayDateRange(startDate, endDate);

    // No transactions found
    if (transactions.length === 0) {
      await ctx.reply(`📭 I couldn't find any transactions for ${dateLabel}${query.category ? ` in ${query.category}` : ""}.`, {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // 1. Dashboard Intent (Phase 7)
    if (query.intent === "dashboard") {
      const detailed = calculateDetailedSummary(transactions);
      const dashboardText = formatFinancialDashboard(detailed, dateLabel);
      await sendLongMessage(ctx, dashboardText);
      return;
    }

    // 2. Transactions Listing (Phase 3)
    if (query.intent === "transactions") {
      const formatted = formatTransactionList(transactions, dateLabel);
      await sendLongMessage(ctx, formatted);
      return;
    }

    // 3. Largest Expense
    if (query.intent === "largest_expense") {
      const expenses = transactions.filter((tx) => tx.type === "expense");
      if (expenses.length === 0) {
        await ctx.reply(`📭 You don't have any expenses recorded for ${dateLabel}.`, {
          reply_markup: mainKeyboard,
        });
        return;
      }

      const largest = expenses.reduce((max, tx) => (Number(tx.amount) > Number(max.amount) ? tx : max));

      const reply = `💸 Your largest expense was:\n\n` +
        `💰 ${formatCurrency(largest.amount)}\n\n` +
        `📂 ${largest.category}\n\n` +
        `📝 ${largest.description || "No description"}\n\n` +
        `📅 ${formatDisplayDate(largest.transaction_date)}`;

      await ctx.reply(reply, {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // 4. Income Query
    if (query.intent === "income") {
      const incomeList = transactions.filter((tx) => tx.type === "income");
      const total = incomeList.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      const reply = `💰 Your income for this period is:\n\n${formatCurrency(total)}\n\n📅 ${dateLabel}`;
      await ctx.reply(reply, {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // 5. Category Query
    if (query.intent === "category") {
      const categoryExpenses = transactions.filter((tx) => tx.type === "expense");
      const total = categoryExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      const catName = query.category || "Selected category";
      const reply = `📂 ${catName} spending:\n\n💸 ${formatCurrency(total)}\n\n📅 ${dateLabel}`;
      await ctx.reply(reply, {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // 6. General Summary (Phase 2 Detailed Summary)
    const detailed = calculateDetailedSummary(transactions);
    const reportText = formatFinancialReport(detailed, dateLabel);
    await sendLongMessage(ctx, reportText);

  } catch (error) {
    console.error("Finance query error:", error);
    await ctx.reply("Something went wrong while analyzing your finance question. Please try again.", {
      reply_markup: mainKeyboard,
    });
  }
}

// ========================================
// Handler: Budgets (Phase 5)
// ========================================

async function handleBudgetCommand(ctx, message) {
  try {
    const budgetCmd = await analyzeBudgetIntent(message);
    console.log("Parsed budget command:", budgetCmd);

    const userId = ctx.from.id;
    const { startDate, endDate } = getMonthRange();

    // 1. Set Budget
    if (budgetCmd.action === "set") {
      if (!budgetCmd.category || !budgetCmd.amount || Number(budgetCmd.amount) <= 0) {
        await ctx.reply("Please specify a category and amount to set a budget.\nExample: \"Set my food budget to ₹5,000\"", {
          reply_markup: mainKeyboard,
        });
        return;
      }

      const saved = await setBudget(userId, {
        category: budgetCmd.category,
        amount: Number(budgetCmd.amount),
        period: budgetCmd.period || "monthly",
      });

      const currentSpending = await getCategorySpending(userId, budgetCmd.category, startDate, endDate);
      const status = calculateBudgetStatus(saved, currentSpending);
      const formatted = formatBudgetStatus(status);

      await ctx.reply(`✅ Budget saved!\n\n${formatted}`, {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // 2. Check Specific Budget
    if (budgetCmd.action === "check" && budgetCmd.category) {
      const budget = await getBudget(userId, budgetCmd.category, budgetCmd.period || "monthly");
      if (!budget) {
        await ctx.reply(`📭 You haven't set a budget for ${budgetCmd.category} yet.\n\nTo set one, say:\n"Set my ${budgetCmd.category.toLowerCase()} budget to ₹5,000"`, {
          reply_markup: mainKeyboard,
        });
        return;
      }

      const currentSpending = await getCategorySpending(userId, budgetCmd.category, startDate, endDate);
      const status = calculateBudgetStatus(budget, currentSpending);
      const formatted = formatBudgetStatus(status);

      await ctx.reply(formatted, {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // 3. List All Budgets
    const budgets = await getUserBudgets(userId, budgetCmd.period || "monthly");
    if (budgets.length === 0) {
      await ctx.reply("📭 You haven't set any budgets yet.\n\nExample: \"Set my food budget to ₹5,000\"", {
        reply_markup: mainKeyboard,
      });
      return;
    }

    const statuses = [];
    for (const b of budgets) {
      const spent = await getCategorySpending(userId, b.category, startDate, endDate);
      statuses.push(calculateBudgetStatus(b, spent));
    }

    const report = formatAllBudgets(statuses);
    await sendLongMessage(ctx, report);

  } catch (error) {
    console.error("Budget command error:", error);
    await ctx.reply(
      error.message && error.message.includes("migrations.sql")
        ? `⚠️ Database setup required: Please run \`src/database/migrations.sql\` in Supabase SQL Editor to enable budgets.`
        : "Something went wrong while processing your budget request. Please try again.",
      { reply_markup: mainKeyboard }
    );
  }
}

// ========================================
// Handler: Recurring Expenses (Phase 6)
// ========================================

async function handleRecurringCommand(ctx, message) {
  try {
    const recurringCmd = await analyzeRecurringIntent(message);
    console.log("Parsed recurring command:", recurringCmd);

    const userId = ctx.from.id;

    // 1. Add Recurring
    if (recurringCmd.action === "add") {
      if (!recurringCmd.description || !recurringCmd.amount || Number(recurringCmd.amount) <= 0) {
        await ctx.reply("Please provide a name and amount for the recurring expense.\nExample: \"Set my Netflix subscription to ₹649 monthly\"", {
          reply_markup: mainKeyboard,
        });
        return;
      }

      const saved = await addRecurringExpense(userId, {
        description: recurringCmd.description,
        amount: Number(recurringCmd.amount),
        frequency: recurringCmd.frequency || "monthly",
        category: recurringCmd.category || "Subscriptions",
      });

      let reply = `✅ Recurring expense added!\n\n`;
      reply += `📌 ${saved.description}\n`;
      reply += `💸 Amount: ${formatCurrency(saved.amount)} (${saved.frequency})\n`;
      reply += `📂 Category: ${saved.category}\n`;
      reply += `📅 Next Due Date: ${formatDisplayDate(saved.next_occurrence)}`;

      await ctx.reply(reply, {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // 2. Remove Recurring
    if (recurringCmd.action === "remove") {
      if (!recurringCmd.description) {
        await ctx.reply("Please specify which recurring expense to remove.\nExample: \"Remove my Netflix recurring expense\"", {
          reply_markup: mainKeyboard,
        });
        return;
      }

      const removed = await removeRecurringExpense(userId, recurringCmd.description);
      if (!removed) {
        await ctx.reply(`📭 Could not find an active recurring expense matching "${recurringCmd.description}".`, {
          reply_markup: mainKeyboard,
        });
        return;
      }

      await ctx.reply(`✅ Removed recurring expense: "${removed.description}" (${formatCurrency(removed.amount)}).`, {
        reply_markup: mainKeyboard,
      });
      return;
    }

    // 3. List Recurring
    const list = await getUserRecurringExpenses(userId, true);
    const formatted = formatRecurringExpensesList(list);
    await sendLongMessage(ctx, formatted);

  } catch (error) {
    console.error("Recurring command error:", error);
    await ctx.reply(
      error.message && error.message.includes("migrations.sql")
        ? `⚠️ Database setup required: Please run \`src/database/migrations.sql\` in Supabase SQL Editor to enable recurring expenses.`
        : "Something went wrong while processing your recurring expense request. Please try again.",
      { reply_markup: mainKeyboard }
    );
  }
}

// ========================================
// Main Message Router (Phase 1 AI Intent Routing)
// ========================================

bot.on("message:text", async (ctx) => {
  const message = ctx.message.text.trim();
  console.log("Message received:", message);

  // Classify High-Level Intent using Gemini
  const { intent } = await classifyFinanceIntent(message);
  console.log("Classified intent:", intent);

  switch (intent) {
    case "add_transaction":
      await handleAddTransaction(ctx, message);
      break;

    case "finance_query":
      await handleFinanceQuery(ctx, message);
      break;

    case "budget":
      await handleBudgetCommand(ctx, message);
      break;

    case "recurring":
      await handleRecurringCommand(ctx, message);
      break;

    case "unknown":
    default:
      await ctx.reply(
        `👋 I'm your AI Finance Assistant! Here are a few things you can do:

💰 Add a transaction:
• "I spent ₹500 on dinner"
• "I earned ₹50,000 salary"

📊 Ask a question:
• "How much did I spend this month?"
• "What was my biggest expense?"
• "Show my expenses for the last 7 days"
• "What did I spend on Monday?"

🎯 Set a budget:
• "Set my food budget to ₹5,000"

🔄 Subscriptions & recurring:
• "Set my Netflix subscription to ₹649 monthly"

Or use the shortcut buttons below 👇`,
        {
          reply_markup: mainKeyboard,
        }
      );
      break;
  }
});

// ========================================
// Global Error Handler
// ========================================

bot.catch((err) => {
  console.error("Telegram bot unhandled error:", err);
});

// ========================================
// Start Telegram Bot
// ========================================

bot.start();

console.log("🤖 AI Finance Assistant is running...");
