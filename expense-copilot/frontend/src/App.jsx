
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Receipt,
  ShieldCheck,
  Bot,
  Settings,
  Search,
  Bell,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Sparkles,
  CalendarDays,
  MoreHorizontal
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip
} from "recharts";

import "./App.css";
import { apiRequest, getHealth } from "./services/api";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatTransactionDate(value) {
  const dateText = typeof value === "string" ? value.slice(0, 10) : value;
  const date = new Date(`${dateText}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function App() {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [authToken, setAuthToken] = useState(
    () => sessionStorage.getItem("expenseCopilotToken")
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authFields, setAuthFields] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    summary: null,
    transactions: [],
    leaks: []
  });
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    let active = true;

    getHealth()
      .then((health) => {
        if (active) {
          const integrations = health.integrations;
          setBackendStatus(
            integrations?.mcp?.connected && integrations?.gemini?.configured
              ? "ready"
              : integrations?.mcp?.connected
                ? "gemini-unconfigured"
                : "mcp-unavailable"
          );
        }
      })
      .catch(() => {
        if (active) {
          setBackendStatus("unreachable");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authToken) {
      return undefined;
    }

    let active = true;

    apiRequest("/auth/me", {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then((result) => {
        if (active) {
          setCurrentUser(result.user);
        }
      })
      .catch(() => {
        sessionStorage.removeItem("expenseCopilotToken");
        if (active) {
          setAuthToken(null);
          setCurrentUser(null);
        }
      });

    return () => {
      active = false;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !currentUser) {
      return undefined;
    }

    let active = true;
    const headers = { Authorization: `Bearer ${authToken}` };

    Promise.all([
      apiRequest("/dashboard/summary", { headers }),
      apiRequest("/transactions?limit=100", { headers }),
      apiRequest("/leaks", { headers })
    ])
      .then(([summaryResult, transactionResult, leakResult]) => {
        if (active) {
          setDashboardData({
            summary: summaryResult.summary,
            transactions: transactionResult.transactions,
            leaks: leakResult.leaks
          });
          setDashboardError("");
        }
      })
      .catch((error) => {
        if (active) {
          setDashboardError(error.message);
        }
      });

    return () => {
      active = false;
    };
  }, [authToken, currentUser]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const result = await apiRequest(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(authFields)
      });
      sessionStorage.setItem("expenseCopilotToken", result.token);
      setDashboardData({ summary: null, transactions: [], leaks: [] });
      setChatMessages([]);
      setCurrentUser(result.user);
      setAuthToken(result.token);
      setAuthFields({ name: "", email: "", password: "" });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const sendChatMessage = async (message) => {
    const text = message.trim();
    if (!text || !authToken || chatLoading) return;

    setChatError("");
    setChatLoading(true);
    setChatInput("");
    setChatMessages((messages) => [...messages, { role: "user", text }]);

    try {
      const result = await apiRequest("/copilot/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          message: text,
          history: chatMessages.slice(-8)
        })
      });
      setChatMessages((messages) => [
        ...messages,
        { role: "model", text: result.reply }
      ]);
    } catch (error) {
      setChatError(error.message);
    } finally {
      setChatLoading(false);
    }
  };

  const backendStatusLabel = {
    checking: "Checking connection...",
    ready: "Gemini configured · MCP ready",
    "gemini-unconfigured": "Gemini key missing",
    "mcp-unavailable": "MCP tools unavailable",
    unreachable: "Backend unavailable"
  }[backendStatus];
  const dashboardSummary = currentUser ? dashboardData.summary : null;
  const accountTransactions = currentUser ? dashboardData.transactions : [];
  const accountLeaks = currentUser ? dashboardData.leaks : [];
  const searchedTransactions = accountTransactions.filter((transaction) => {
    const query = searchQuery.trim().toLowerCase();
    return !query ||
      transaction.merchant.toLowerCase().includes(query) ||
      transaction.category.toLowerCase().includes(query);
  });
  const displayTransactions = showAllTransactions
    ? searchedTransactions
    : searchedTransactions.slice(0, 4);
  const currentMonthKey = dashboardSummary?.month || "";
  const spendingByDay = new Map();
  for (const transaction of accountTransactions) {
    if (transaction.transaction_type !== "debit") continue;
    const date = String(transaction.transaction_date).slice(0, 10);
    if (!date.startsWith(currentMonthKey)) continue;
    const day = date.slice(-2);
    if (/^\d{2}$/.test(day)) {
      spendingByDay.set(
        day,
        (spendingByDay.get(day) || 0) + Number(transaction.amount)
      );
    }
  }
  const spendingData = [...spendingByDay.entries()]
    .map(([day, amount]) => ({ day, amount }))
    .sort((left, right) => left.day.localeCompare(right.day));
  const potentialLeaks = accountLeaks.reduce((total, leak) => {
    if (leak.type === "possible_duplicate") return total + Number(leak.amount);
    if (leak.type === "budget_exceeded") return total + Number(leak.excess);
    return total;
  }, 0);
  const currentMonth = dashboardSummary?.month
    ? new Date(`${dashboardSummary.month}-15T12:00:00`).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
      })
    : "Current month";
  const userInitials = currentUser?.name
    ? currentUser.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
    : "—";

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={23} />
          </div>

          <div>
            <h2>Expense<span>Copilot</span></h2>
            <p>SMART FINANCE</p>
          </div>
        </div>

        <div className="menu-label">WORKSPACE</div>

        <nav className="navigation">

          <a className="nav-item active">
            <LayoutDashboard size={19} />
            Dashboard
          </a>

          <a className="nav-item">
            <Wallet size={19} />
            Transactions
          </a>

          <a className="nav-item">
            <Receipt size={19} />
            Receipts
          </a>

          <a className="nav-item">
            <ArrowLeftRight size={19} />
            Subscriptions
          </a>

          <a className="nav-item">
            <Bot size={19} />
            AI Copilot
            <span className="new-tag">AI</span>
          </a>

          <div className="menu-label security-label">
            SECURITY
          </div>

          <a className="nav-item">
            <ShieldCheck size={19} />
            MCP Firewall
          </a>

          <a className="nav-item">
            <ShieldAlert size={19} />
            Flight Recorder
          </a>

        </nav>

        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-card-icon">
              <ShieldCheck size={18} />
            </div>

            <h4>Firewall Active</h4>
            <p>Your financial data is protected.</p>

            <div className={`online-status ${backendStatus === "ready" ? "" : "service-status-warning"}`}>
              <span></span>
              {backendStatusLabel}
            </div>
          </div>

          <a className="nav-item">
            <Settings size={19} />
            Settings
          </a>

          <div className="profile">
            <div className="avatar">{userInitials}</div>
            <div>
              <h4>{currentUser?.name || "Not signed in"}</h4>
              <p>{currentUser?.email || "Connect your account"}</p>
            </div>
          </div>
        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">

        <header className="topbar">

          <div>
            <h1>Dashboard</h1>
            <p>Welcome back! Here's your financial overview.</p>
          </div>

          <div className="top-actions">

            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="Search transactions"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <button className="icon-button">
              <Bell size={19} />
            </button>

            <div className="avatar top-avatar">{userInitials}</div>

          </div>

        </header>

        <section className="dashboard-body">

          <div className="section-heading">
            <div>
              <h2>Financial Overview</h2>
              <p>
                {currentUser
                  ? "Monitor your money and identify unnecessary spending."
                  : "Sign in to load your financial overview."}
              </p>
            </div>

            <button className="date-button">
              <CalendarDays size={17} />
              {currentMonth}
            </button>
          </div>

          {/* STAT CARDS */}

          <div className="stats-grid">

            <div className="stat-card">
              <div className="stat-top">
                <span>Net Cash Flow</span>
                <div className="stat-icon purple">
                  <Wallet size={20} />
                </div>
              </div>

              <h2>{dashboardSummary ? formatCurrency(dashboardSummary.balance) : "—"}</h2>

              <div className="stat-footer positive">
                <TrendingUp size={15} />
                {currentUser ? "This month" : "Sign in to view"}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Total Income</span>
                <div className="stat-icon green">
                  <ArrowDownRight size={20} />
                </div>
              </div>

              <h2>{dashboardSummary ? formatCurrency(dashboardSummary.totalIncome) : "—"}</h2>

              <div className="stat-footer positive">
                <TrendingUp size={15} />
                This month
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Total Expenses</span>
                <div className="stat-icon orange">
                  <ArrowUpRight size={20} />
                </div>
              </div>

              <h2>{dashboardSummary ? formatCurrency(dashboardSummary.totalExpenses) : "—"}</h2>

              <div className="stat-footer negative">
                <TrendingUp size={15} />
                This month
              </div>
            </div>

            <div className="stat-card highlight-card">
              <div className="stat-top">
                <span>Potential Money Leaks</span>
                <div className="stat-icon red">
                  <AlertTriangle size={20} />
                </div>
              </div>

              <h2>{currentUser ? formatCurrency(potentialLeaks) : "—"}</h2>

              <div className="stat-footer warning-text">
                {currentUser ? `${accountLeaks.length} items need attention` : "Sign in to view"}
              </div>
            </div>

          </div>

          {/* CHART + AI COPILOT */}

          <div className="middle-grid">

            <div className="panel spending-panel">

              <div className="panel-heading">
                <div>
                  <h3>Spending Activity</h3>
                  <p>Your spending throughout the month</p>
                </div>

                <button className="more-button">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="chart-total">
                {dashboardSummary
                  ? formatCurrency(dashboardSummary.totalExpenses)
                  : "—"}
                <span>{currentMonth} spending</span>
              </div>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spendingData}>
                    <defs>
                      <linearGradient
                        id="spendingGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#6366f1"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9096a5", fontSize: 11 }}
                    />

                    <Tooltip
                      formatter={(value) => [
                        formatCurrency(value),
                        "Spending"
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="url(#spendingGradient)"
                    />

                  </AreaChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* AI COPILOT */}

            <div className="panel ai-panel">

              <div className="ai-heading">
                <div className="ai-logo">
                  <Sparkles size={20} />
                </div>

                <div>
                  <h3>AI Expense Copilot</h3>
                  <p>Your financial assistant</p>
                </div>

                <span className={`ai-online ${backendStatus === "ready" ? "" : "service-status-warning"}`}></span>
              </div>

              {!authToken || !currentUser ? (
                <div className="ai-auth">
                  {authToken ? (
                    <p>Restoring your secure session...</p>
                  ) : (
                    <>
                      <p>Sign in to let Gemini securely review your financial data.</p>
                      <form onSubmit={handleAuthSubmit}>
                        {authMode === "register" && (
                          <input
                            autoComplete="name"
                            maxLength={100}
                            placeholder="Name"
                            required
                            value={authFields.name}
                            onChange={(event) => setAuthFields({
                              ...authFields,
                              name: event.target.value
                            })}
                          />
                        )}
                        <input
                          autoComplete="email"
                          type="email"
                          placeholder="Email"
                          required
                          value={authFields.email}
                          onChange={(event) => setAuthFields({
                            ...authFields,
                            email: event.target.value
                          })}
                        />
                        <input
                          autoComplete={authMode === "login" ? "current-password" : "new-password"}
                          type="password"
                          minLength={8}
                          placeholder="Password"
                          required
                          value={authFields.password}
                          onChange={(event) => setAuthFields({
                            ...authFields,
                            password: event.target.value
                          })}
                        />
                        <button type="submit" disabled={authLoading}>
                          {authLoading
                            ? "Please wait..."
                            : authMode === "login" ? "Sign in" : "Create account"}
                        </button>
                      </form>
                      <button
                        className="auth-toggle"
                        type="button"
                        onClick={() => {
                          setAuthError("");
                          setAuthMode(authMode === "login" ? "register" : "login");
                        }}
                      >
                        {authMode === "login"
                          ? "New here? Create an account"
                          : "Already registered? Sign in"}
                      </button>
                      {authError && <p className="chat-error" role="alert">{authError}</p>}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="ai-conversation" aria-live="polite">
                    {chatMessages.length === 0 && (
                      <div className="message-bubble">
                        Hi {currentUser.name}. Ask me to review your transactions,
                        budgets, or receipts.
                      </div>
                    )}
                    {chatMessages.map((message, index) => (
                      <div
                        className={`chat-message ${message.role === "user" ? "user" : "assistant"}`}
                        key={`${message.role}-${index}`}
                      >
                        {message.text}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="chat-message assistant">
                        Checking your financial data...
                      </div>
                    )}
                  </div>
                  {chatError && <p className="chat-error" role="alert">{chatError}</p>}
                  <div className="suggestions">
                    <button
                      disabled={chatLoading}
                      onClick={() => sendChatMessage("Review my recent transactions for unusual spending.")}
                    >
                      Review spending
                    </button>
                    <button
                      disabled={chatLoading}
                      onClick={() => sendChatMessage("Are any of my budgets over their limits?")}
                    >
                      Check budgets
                    </button>
                  </div>
                  <form
                    className="chat-input"
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendChatMessage(chatInput);
                    }}
                  >
                    <input
                      aria-label="Ask the expense copilot"
                      placeholder="Ask about your expenses..."
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      disabled={chatLoading}
                    />
                    <button type="submit" disabled={chatLoading || !chatInput.trim()}>
                      <Send size={17} />
                    </button>
                  </form>
                  <div className="ai-disclaimer">
                    Gemini reads your data through the MCP security firewall.
                  </div>
                </>
              )}

            </div>

          </div>

          {/* TRANSACTIONS + MONEY LEAKS */}

          <div className="bottom-grid">

            <div className="panel transactions-panel">

              <div className="panel-heading">
                <div>
                  <h3>Recent Transactions</h3>
                  <p>Your latest financial activity</p>
                </div>

                <button
                  className="view-all"
                  type="button"
                  onClick={() => setShowAllTransactions((shown) => !shown)}
                >
                  {showAllTransactions ? "Show less" : "View all"}
                  <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="transaction-list">

                {dashboardError && currentUser && (
                  <p className="chat-error" role="alert">{dashboardError}</p>
                )}
                {displayTransactions.length === 0 && (
                  <p className="empty-state">
                    {currentUser
                      ? searchQuery ? "No matching transactions." : "No transactions found."
                      : "Sign in to view transactions."}
                  </p>
                )}
                {displayTransactions.map((item) => (
                  <div className="transaction-row" key={item.id}>

                    <div className="merchant-avatar">
                      {item.merchant?.[0]?.toUpperCase() || "?"}
                    </div>

                    <div className="merchant-details">
                      <h4>{item.merchant}</h4>
                      <p>{item.category} · {formatTransactionDate(item.transaction_date)}</p>
                    </div>

                    <div className="transaction-amount">
                      <h4>
                        {item.transaction_type === "debit" ? "−" : "+"}
                        {formatCurrency(item.amount)}
                      </h4>
                      <span className={`status ${item.transaction_type === "credit" ? "success" : "warning"}`}>
                        {item.transaction_type === "credit" ? "Income" : "Expense"}
                      </span>
                    </div>

                  </div>
                ))}

              </div>

            </div>

            <div className="panel leaks-panel">

              <div className="panel-heading">
                <div>
                  <h3>Money Leaks</h3>
                  <p>Potential unnecessary spending</p>
                </div>

                <AlertTriangle
                  size={19}
                  color="#e89a32"
                />
              </div>

              {accountLeaks.length === 0 && (
                <p className="empty-state">
                  {currentUser ? "No potential leaks detected." : "Sign in to scan for leaks."}
                </p>
              )}
              {accountLeaks.slice(0, 3).map((leak, index) => {
                const isDuplicate = leak.type === "possible_duplicate";
                const isBudget = leak.type === "budget_exceeded";
                const title = isDuplicate
                  ? "Possible duplicate payment"
                  : isBudget
                    ? "Budget exceeded"
                    : "Upcoming subscription";
                const description = isDuplicate
                  ? `${leak.merchant} · Possible duplicate`
                  : isBudget
                    ? `${leak.category} · Spent ${formatCurrency(leak.spent)}`
                    : `${leak.merchant} · ${formatTransactionDate(leak.renewalDate)}`;
                const amount = isDuplicate ? leak.amount : isBudget ? leak.excess : leak.amount;

                return (
                  <div className="leak-item" key={`${leak.type}-${index}`}>
                    <div className={`leak-icon ${isDuplicate ? "duplicate" : isBudget ? "increase" : "renewal"}`}>
                      {isDuplicate
                        ? <ArrowLeftRight size={18} />
                        : isBudget
                          ? <TrendingUp size={18} />
                          : <CalendarDays size={18} />}
                    </div>
                    <div className="leak-details">
                      <h4>{title}</h4>
                      <p>{description}</p>
                    </div>
                    <strong>{formatCurrency(amount)}</strong>
                  </div>
                );
              })}

              <button
                className="analyse-button"
                type="button"
                disabled={!currentUser || chatLoading}
                onClick={() => sendChatMessage("Analyze my potential money leaks and explain the biggest risks.")}
              >
                Analyse all money leaks
                <ArrowUpRight size={17} />
              </button>

            </div>

          </div>

          <footer className="footer">
            Expense Copilot · Financial intelligence protected
            by MCP Firewall.
          </footer>

        </section>

      </main>

    </div>
  );
}

export default App;