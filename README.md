# 🤖 AI Finance Tracker Telegram Bot

A smart personal finance assistant bot built for Telegram, powered by **Google Gemini AI**, **grammY**, and **Supabase (PostgreSQL)**. 

Track expenses and income using plain natural language, monitor category budgets with proactive alerts, manage recurring subscriptions, query custom date ranges, and view beautiful financial dashboards directly inside Telegram.

---

## ✨ Features

- 🧠 **Natural Language Transaction Logging**: Record spending, income, or starting balance naturally (e.g., *"Spent ₹450 on dinner"*, *"Salary ₹75,000 received"*, *"I currently have 20000 in my account"*).
- 🧭 **Multi-Intent AI Routing**: Automatically classifies inputs into transactions, financial queries, budgets, recurring expenses, or friendly guidance.
- 📊 **Financial Dashboard**: Comprehensive breakdown of income, expenses, net balance, categorized spending with emojis, top category, and largest expense.
- 📅 **Advanced Date Intelligence (`Asia/Kolkata`)**:
  - Relative dates: *"today"*, *"yesterday"*, *"this week"*, *"this month"*, *"last month"*
  - Weekdays: *"What did I spend on Monday?"*
  - Relative offsets: *"2 days ago"*, *"last 7 days"*, *"last 30 days"*
  - Custom ranges: *"from 1 September to 15 September"*
- 🎯 **Category Budgets & Proactive Warnings**:
  - Set limits per category and period (monthly, weekly, yearly).
  - Automatically receives **⚠️ 80% warning** and **🚨 100% exceeded** alerts whenever you log an expense approaching your budget limit.
- 🔄 **Subscriptions & Recurring Expenses**:
  - Track repeating payments (Netflix, Spotify, rent, gym, Wi-Fi).
  - Automatically calculates next occurrence dates.
- 📋 **Grouped Visual Transactions**:
  - Grouped by date descending with card formatting (`💸 ₹500` / `💰 ₹50,000`).
  - Formats whole numbers cleanly (`₹500`) and decimals with precision (`₹350.50`).
  - Automatic message chunking to safely bypass Telegram's 4096-character limit without truncation.
- ⚡ **1-Tap Shortcut Keyboard**: Quick access buttons for **`📈 Dashboard`**, **`📊 Today`**, **`📅 This Month`**, **`💸 Today's Expenses`**, and **`📋 Transactions`**.

---

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (ES Modules)
- **Telegram Bot Framework**: [grammY](https://grammy.dev/)
- **AI / LLM**: [Google Gen AI SDK](https://www.npmjs.com/package/@google/genai) (`gemini-3.5-flash-lite` primary with `gemini-3.5-flash` backup)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Environment Management**: `dotenv`
- **Development Tooling**: `nodemon`

---

## 📁 Project Structure

```text
FinanceBot/
├── src/
│   ├── bot.js                  # Main Telegram bot initialization & message routing
│   ├── database/
│   │   ├── supabase.js         # Supabase client connection
│   │   └── migrations.sql      # Database schema (budgets & recurring_expenses)
│   ├── services/
│   │   ├── ai.js               # Gemini AI intent classification & entity extraction
│   │   ├── budget.js           # Budget limits, status & warning checks
│   │   ├── recurring.js        # Recurring expenses & subscription tracking
│   │   ├── summary.js          # Financial metrics calculations
│   │   └── transaction.js      # Supabase transaction CRUD operations
│   └── utils/
│       ├── date.js             # Asia/Kolkata timezone & date range calculations
│       └── format.js           # Currency, report, dashboard, & card formatters
├── .env.example                # Example environment variables template
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A Telegram account to create your bot via [@BotFather](https://t.me/botfather)
- A [Google AI Studio](https://aistudio.google.com/) API key
- A free [Supabase](https://supabase.com/) project

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/FinanceBot.git
cd FinanceBot
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Fill in your actual credentials:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_from_botfather
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_service_or_anon_key
```

### 5. Database Setup (Supabase)

1. Open your **Supabase Dashboard** ➔ Go to **SQL Editor**.
2. Run the existing `transactions` table script (if not already created):
   ```sql
   create table if not exists public.transactions (
     id uuid primary key default gen_random_uuid(),
     user_id bigint not null,
     type text not null check (type in ('income', 'expense')),
     amount numeric(12, 2) not null check (amount > 0),
     currency text not null default 'INR',
     category text not null,
     description text,
     transaction_date date not null default current_date,
     created_at timestamptz not null default now()
   );
   ```
3. Run the migrations in [`src/database/migrations.sql`](src/database/migrations.sql) to create the `budgets` and `recurring_expenses` tables.

### 6. Run the Bot

#### Development Mode (Auto-reloads on file changes):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

Once started, you will see:
```text
🤖 AI Finance Assistant is running...
```

---

## 💬 Usage Examples

### 💸 Logging Transactions
- *"Spent ₹450 on dinner with friends"*
- *"Paid 120 for auto"*
- *"Received ₹50,000 salary"*
- *"Bought groceries for 1,250"*
- *"I currently have 20000 in my account"* *(records initial balance)*

### 📊 Querying Spending & Reports
- Tap **`📈 Dashboard`** or type `/dashboard`
- *"How much did I spend this month?"*
- *"Show my expenses for the last 7 days"*
- *"What did I spend on Monday?"*
- *"What was my biggest expense this month?"*
- *"Show my transactions from 1 September to 15 September"*

### 🎯 Setting & Checking Budgets
- *"Set my food budget to ₹6,000"*
- *"Check my food budget"*
- *"Show my budgets"* or `/budgets`

### 🔄 Managing Subscriptions & Recurring Expenses
- *"Set my Netflix subscription to ₹649 monthly"*
- *"Add recurring gym fee of ₹1,500 monthly"*
- *"Show my recurring expenses"* or `/recurring`
- *"Remove my Netflix recurring expense"*

---

## 🔒 Security & Privacy

- All user data is partitioned by Telegram `user_id` to ensure strict separation between users.
- Environment variables (`.env`) are excluded from version control via `.gitignore`.
- Row-Level Security (RLS) policies are configured in Supabase.

---

## 📄 License

This project is open source and available under the [ISC License](LICENSE).
