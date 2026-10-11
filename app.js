/* =====================================================
   MY FINANCE APP
   Dashboard, salary intake, transactions, budgets, reports
===================================================== */

let dashboardState = null;

// -------------------------
// COMMON HELPERS
// -------------------------

function isActive(value) {
  return (
    value === true ||
    value === 1 ||
    String(value).trim().toUpperCase() === "TRUE"
  );
}

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = getElement(id);
  if (element) element.textContent = value == null ? "" : String(value);
}

function safeRender(label, callback) {
  try {
    callback();
  } catch (error) {
    console.error(`Failed to render ${label}:`, error);
  }
}

function formatCurrency(amount) {
  const number = Number(amount);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function localMonthString(date = new Date()) {
  return (
    `${date.getFullYear()}-` + `${String(date.getMonth() + 1).padStart(2, "0")}`
  );
}

function setDefaultTransactionDates() {
  const today = localDateString();

  ["expense-date", "income-date", "transfer-date"].forEach((id) => {
    const input = getElement(id);

    if (input && !input.value) {
      input.value = today;
    }
  });
}

function setDefaultSalaryFields() {
  const salaryMonth = getElement("salary-month");
  const receivedDate = getElement("salary-received-date");

  if (salaryMonth && !salaryMonth.value) {
    salaryMonth.value = localMonthString();
  }

  if (receivedDate && !receivedDate.value) {
    receivedDate.value = localDateString();
  }
}

// -------------------------
// LOAD DASHBOARD
// -------------------------

async function loadDashboard() {
  console.log("=== LOAD DASHBOARD START ===");

  let data;

  try {
    data = await getDashboard();
  } catch (error) {
    console.error("=== DASHBOARD API ERROR ===", error);

    setText("total-balance", "Failed to load data.");
    setText("monthly-income", "Failed to load data.");
    setText("monthly-expense", "Failed to load data.");
    setText("monthly-net", "Failed to load data.");

    const pendingContainer = getElement("pending-salaries");

    if (pendingContainer) {
      pendingContainer.textContent = "Unable to load pending salaries.";
    }

    return;
  }

  if (!data || data.success !== true || !data.summary) {
    console.error("Dashboard returned an unexpected response:", data);
    setText("total-balance", "Failed to load data.");
    return;
  }

  dashboardState = data;

  console.log("API BUDGET DATA:", data.budget_usage);
  console.log("Dashboard received:", data);
  console.log("Total balance:", data.summary.total_balance);
  console.log("Accounts:", data.accounts);
  console.log("Transactions:", data.transactions);

  // Render summary first. Errors in other sections should not
  // replace a successfully loaded balance with an error message.
  safeRender("dashboard summary", () => {
    setText("total-balance", formatCurrency(data.summary.total_balance));

    setText("monthly-income", formatCurrency(data.summary.monthly_income));

    setText("monthly-expense", formatCurrency(data.summary.monthly_expense));

    setText("monthly-net", formatCurrency(data.summary.monthly_net));

    setText("current-month", data.summary.month || localMonthString());
  });

  safeRender("dashboard", () => {
    displayDashboard(data);
  });

  const lastUpdated = getElement("last-updated");

  if (lastUpdated) {
    lastUpdated.textContent = "Updated: " + new Date().toLocaleTimeString();
  }

  // Load pending salary independently from the dashboard.
  if (typeof loadPendingSalaries === "function") {
    await loadPendingSalaries();
  }

  console.log("=== LOAD DASHBOARD SUCCESS ===");
}

function displayDashboard(data) {
  const summary = data.summary || {};
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const transactions = Array.isArray(data.transactions)
    ? data.transactions
    : [];
  const salaryRules = Array.isArray(data.salary_rules) ? data.salary_rules : [];

  safeRender("accounts", () => {
    displayAccounts(accounts);
  });

  safeRender("recent transactions", () => {
    displayTransactions(transactions);
  });

  safeRender("budget overview", () => {
    if (typeof window.displayBudgetOverview === "function") {
      window.displayBudgetOverview(data.budget_usage);
    }
  });

  const reportMonthPicker = getElement("report-month-picker");

  if (reportMonthPicker && !reportMonthPicker.value) {
    reportMonthPicker.value = summary.month || localMonthString();
  }

  const selectedReportMonth =
    (reportMonthPicker && reportMonthPicker.value) ||
    summary.month ||
    localMonthString();

  safeRender("reports", () => {
    if (typeof window.displayReports === "function") {
      window.displayReports(transactions, categories, selectedReportMonth);
    }
  });

  safeRender("expense accounts", () => {
    displayExpenseAccounts(accounts);
  });

  safeRender("expense categories", () => {
    displayExpenseCategories(categories);
  });

  safeRender("income accounts", () => {
    displayIncomeAccounts(accounts);
  });

  safeRender("income categories", () => {
    displayIncomeCategories(categories);
  });

  safeRender("salary categories", () => {
    displaySalaryCategories(categories, salaryRules);
  });

  safeRender("transaction account filter", () => {
    displayTransactionAccountFilter(accounts);
  });

  safeRender("transaction category filter", () => {
    displayTransactionCategoryFilter(categories);
  });

  safeRender("transfer accounts", () => {
    displayTransferAccounts(accounts);
  });

  safeRender("transaction history", () => {
    displayTransactionHistory();
  });
}

// -------------------------
// SALARY CATEGORY / INTAKE
// -------------------------

function displaySalaryCategories(categories, salaryRules) {
  const salarySelect = getElement("salary-category");
  const helpText = getElement("salary-category-help");

  if (!salarySelect) {
    console.warn("Salary category dropdown not found.");
    return;
  }

  const activeRules = (Array.isArray(salaryRules) ? salaryRules : []).filter(
    (rule) =>
      isActive(rule.active) &&
      String(rule.source_account_id || "").trim() === "ACC001" &&
      rule.trigger_category_id,
  );

  const triggerCategoryIds = new Set(
    activeRules.map((rule) => String(rule.trigger_category_id).trim()),
  );

  const matchedCategories = (
    Array.isArray(categories) ? categories : []
  ).filter(
    (category) =>
      isActive(category.active) &&
      String(category.category_type || "")
        .trim()
        .toUpperCase() === "INCOME" &&
      triggerCategoryIds.has(String(category.category_id || "").trim()),
  );

  const previousValue = salarySelect.value;

  salarySelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select salary category --";
  salarySelect.appendChild(placeholder);

  matchedCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.category_id;
    option.textContent = category.category_name;
    salarySelect.appendChild(option);
  });

  if (
    matchedCategories.some(
      (category) => String(category.category_id) === previousValue,
    )
  ) {
    salarySelect.value = previousValue;
  }

  if (helpText) {
    helpText.textContent = matchedCategories.length
      ? "Select the income category that matches your active salary distribution rules."
      : "No matching categories found. Check active INCOME categories and Salary_Rules for source account ACC001.";
  }

  console.log("Salary categories rendered:", matchedCategories.length);
}

async function submitReceiveSalary(event) {
  event.preventDefault();

  const form = getElement("salary-form");
  const salaryMonth = getElement("salary-month")?.value || "";
  const receivedDate = getElement("salary-received-date")?.value || "";
  const amount = Number(getElement("salary-amount")?.value);
  const categoryId = getElement("salary-category")?.value || "";
  const description = getElement("salary-description")?.value.trim() || "";
  const status = getElement("salary-status");

  if (
    !salaryMonth ||
    !receivedDate ||
    !categoryId ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    if (status) {
      status.textContent =
        "Please enter the salary month, received date, valid amount, and category.";
    }

    return;
  }

  if (typeof receiveSalary !== "function") {
    if (status) {
      status.textContent = "Salary API is missing from api.js.";
    }

    console.error("receiveSalary() is not defined. Check api.js.");

    return;
  }

  if (status) {
    status.textContent = "Saving salary...";
  }

  try {
    const result = await receiveSalary({
      salaryMonth,
      receivedDate,
      amount,
      sourceAccountId: "ACC001",
      categoryId,
      description,
    });

    console.log("RECEIVE SALARY RESULT:", result);

    if (status) {
      status.textContent =
        "Salary received and marked pending for distribution.";
    }

    if (form) {
      form.reset();
    }

    setDefaultSalaryFields();
    setDefaultTransactionDates();

    await loadDashboard();
  } catch (error) {
    console.error("RECEIVE SALARY ERROR:", error);

    if (status) {
      status.textContent = "Error: " + error.message;
    }
  }
}

function displayPendingSalaries(salaries) {
  const container = document.getElementById("pending-salaries");

  if (!container) {
    console.warn("Pending salaries container not found.");
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(salaries)) {
    container.textContent = "Pending salary data unavailable.";
    return;
  }

  if (salaries.length === 0) {
    container.textContent = "No pending salaries.";
    return;
  }

  salaries.forEach((salary) => {
    const card = document.createElement("article");
    card.className = "pending-salary-card";

    const salaryId = String(salary.salary_id || "");
    const statusValue = String(salary.status || "PENDING")
      .trim()
      .toUpperCase();

    const title = document.createElement("h3");
    title.className = "pending-salary-title";
    title.textContent = "Salary " + (salary.salary_month || "(month not set)");

    const details = document.createElement("p");
    details.textContent =
      "Received: " + (salary.received_date || salary.receivedDate || "Not set");

    const amount = document.createElement("p");
    amount.className = "pending-salary-amount";
    amount.textContent = formatCurrency(salary.amount);

    const status = document.createElement("p");
    status.className = "pending-salary-status";
    status.textContent = "Status: " + statusValue;

    card.append(title, details, amount, status);

    if (salary.description) {
      const description = document.createElement("p");
      description.textContent = salary.description;
      card.appendChild(description);
    }

    if (statusValue === "ERROR" && salary.error_message) {
      const error = document.createElement("p");
      error.className = "pending-salary-error";
      error.textContent = "Manual review required: " + salary.error_message;
      card.appendChild(error);
    }

    if (statusValue === "PROCESSING") {
      const warning = document.createElement("p");
      warning.textContent =
        "Distribution needs verification. Do not retry automatically.";
      card.appendChild(warning);
    }

    const previewArea = document.createElement("div");
    previewArea.className = "pending-salary-preview";
    card.appendChild(previewArea);

    if (statusValue === "PENDING") {
      const previewButton = document.createElement("button");
      previewButton.type = "button";
      previewButton.textContent = "Preview distribution";

      previewButton.addEventListener("click", async () => {
        if (!salaryId) {
          previewArea.textContent = "Salary ID is missing.";
          return;
        }

        previewButton.disabled = true;
        previewButton.textContent = "Calculating...";
        previewArea.innerHTML = "";

        try {
          const preview = await previewSalaryDistribution(salaryId);

          if (!Array.isArray(preview.allocations)) {
            throw new Error("The server did not return an allocation list.");
          }

          const heading = document.createElement("h4");
          heading.textContent = "Distribution preview";
          previewArea.appendChild(heading);

          const list = document.createElement("div");

          preview.allocations.forEach((allocation) => {
            const row = document.createElement("p");

            const destination =
              allocation.destination_account_name ||
              allocation.destination_account_id;

            row.textContent =
              destination +
              " — " +
              allocation.percentage +
              "% — " +
              formatCurrency(allocation.amount);

            list.appendChild(row);
          });

          previewArea.appendChild(list);

          const total = document.createElement("p");
          total.textContent =
            "Total to distribute: " + formatCurrency(preview.total_allocated);

          previewArea.appendChild(total);

          const confirmButton = document.createElement("button");
          confirmButton.type = "button";
          confirmButton.textContent = "Confirm distribution";

          confirmButton.addEventListener("click", async () => {
            const confirmed = window.confirm(
              "Distribute " +
                formatCurrency(preview.total_allocated) +
                " from " +
                preview.salary.source_account_id +
                " to the accounts shown above?\n\n" +
                "This will create real transfer transactions.",
            );

            if (!confirmed) return;

            confirmButton.disabled = true;
            previewButton.disabled = true;
            confirmButton.textContent = "Distributing...";
            status.textContent = "Status: PROCESSING";

            try {
              const result = await distributePendingSalary(salaryId);

              console.log("SALARY DISTRIBUTION RESULT:", result);

              status.textContent = "Status: DISTRIBUTED";

              const message = document.createElement("p");
              message.textContent =
                result.message || "Salary distribution completed.";

              previewArea.appendChild(message);

              await loadDashboard();
            } catch (error) {
              console.error("SALARY DISTRIBUTION ERROR:", error);

              status.textContent = "Status: VERIFY REQUIRED";

              const errorMessage = document.createElement("p");

              errorMessage.className = "pending-salary-error";
              errorMessage.textContent =
                "Check Salary_Payments and Transactions before retrying: " +
                error.message;

              previewArea.appendChild(errorMessage);
              confirmButton.disabled = true;
            }
          });

          previewArea.appendChild(confirmButton);
        } catch (error) {
          console.error("SALARY PREVIEW ERROR:", error);

          previewArea.textContent = "Unable to preview: " + error.message;
        } finally {
          previewButton.disabled = false;
          previewButton.textContent = "Preview distribution";
        }
      });

      card.appendChild(previewButton);
    }

    container.appendChild(card);
  });
}

async function loadPendingSalaries() {
  const container = getElement("pending-salaries");

  if (!container) return;

  if (typeof getPendingSalaries !== "function") {
    container.textContent = "Pending salary API is missing from api.js.";

    console.error("getPendingSalaries() is not defined. Check api.js.");

    return;
  }

  try {
    const result = await getPendingSalaries();

    console.log("PENDING SALARIES RESULT:", result);

    let salaries = [];

    if (Array.isArray(result)) {
      salaries = result;
    } else if (result && Array.isArray(result.salaries)) {
      salaries = result.salaries;
    } else if (result && Array.isArray(result.pending_salaries)) {
      salaries = result.pending_salaries;
    } else if (result && Array.isArray(result.pendingSalaries)) {
      salaries = result.pendingSalaries;
    } else if (result && result.data && Array.isArray(result.data.salaries)) {
      salaries = result.data.salaries;
    } else if (result && Array.isArray(result.data)) {
      salaries = result.data;
    }

    displayPendingSalaries(salaries);
  } catch (error) {
    console.error("LOAD PENDING SALARIES ERROR:", error);

    container.textContent = "Unable to load pending salaries: " + error.message;
  }
}

// -------------------------
// BUDGET OVERVIEW
// -------------------------

window.displayBudgetOverview = function (budgets) {
  const container = getElement("budget-overview");

  if (!container) {
    console.error("Budget overview element not found.");
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(budgets)) {
    container.textContent = "Budget data unavailable.";
    console.error("Invalid budget data:", budgets);
    return;
  }

  const activeBudgets = budgets.filter((budget) => isActive(budget.active));

  if (activeBudgets.length === 0) {
    container.textContent = "No active budgets found.";
    return;
  }

  activeBudgets.forEach((budget) => {
    const card = document.createElement("article");
    card.className = "budget-card";

    const header = document.createElement("div");
    header.className = "budget-card-header";

    const titleGroup = document.createElement("div");

    const title = document.createElement("h3");
    title.className = "budget-name";
    title.textContent = budget.category_name || budget.category_id || "Budget";

    const period = document.createElement("p");
    period.className = "budget-period";
    period.textContent = `Month: ${budget.month || "-"}`;

    titleGroup.append(title, period);

    const percentage = Number(budget.usage_percentage) || 0;

    const percentageLabel = document.createElement("strong");
    percentageLabel.className = "budget-percentage";
    percentageLabel.textContent = `${percentage}%`;

    header.append(titleGroup, percentageLabel);
    card.appendChild(header);

    const amountText = document.createElement("p");
    amountText.className = "budget-amount";

    amountText.textContent =
      `${formatCurrency(budget.spent)} / ` +
      `${formatCurrency(budget.budget_amount)}`;

    card.appendChild(amountText);

    const track = document.createElement("div");
    track.className = "budget-progress-track";

    const fill = document.createElement("div");
    fill.className = "budget-progress-fill";

    fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;

    const overBudget =
      budget.over_budget === true ||
      String(budget.over_budget).toUpperCase() === "TRUE";

    if (overBudget) {
      fill.classList.add("over-budget");
      card.classList.add("budget-card-over");
    }

    track.appendChild(fill);
    card.appendChild(track);

    const remaining = Number(budget.remaining) || 0;

    const remainingText = document.createElement("p");
    remainingText.className = overBudget
      ? "budget-remaining over-budget"
      : "budget-remaining";

    remainingText.textContent = overBudget
      ? `Over budget by ${formatCurrency(Math.abs(remaining))}`
      : `Remaining: ${formatCurrency(remaining)}`;

    card.appendChild(remainingText);

    if (budget.notes) {
      const notes = document.createElement("p");
      notes.className = "budget-notes";
      notes.textContent = budget.notes;
      card.appendChild(notes);
    }

    container.appendChild(card);
  });

  console.log("Budget overview rendered:", activeBudgets.length);
};

// -------------------------
// REPORTS & ANALYTICS
// -------------------------

window.displayReports = function (transactions, categories, currentMonth) {
  const incomeElement = getElement("report-month-income");
  const expenseElement = getElement("report-month-expense");
  const netElement = getElement("report-month-net");
  const savingsElement = getElement("report-savings-rate");
  const chartContainer = getElement("monthly-report-chart");
  const categoryContainer = getElement("expense-category-report");
  const periodElement = getElement("expense-breakdown-period");

  if (
    !incomeElement ||
    !expenseElement ||
    !netElement ||
    !savingsElement ||
    !chartContainer ||
    !categoryContainer
  ) {
    console.error("Reports HTML elements are missing.");
    return;
  }

  if (!Array.isArray(transactions)) {
    console.error("Invalid transactions for reports.");
    return;
  }

  if (!currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
    currentMonth = localMonthString();
  }

  const [year, month] = currentMonth.split("-").map(Number);

  function makeMonthKey(date) {
    return (
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  }

  function getMonthLabel(monthKey, options = {}) {
    const [y, m] = monthKey.split("-").map(Number);

    return new Date(y, m - 1, 1).toLocaleDateString("en-US", options);
  }

  // CURRENT MONTH SUMMARY
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  transactions.forEach((transaction) => {
    const transactionMonth = String(transaction.date || "").slice(0, 7);

    if (transactionMonth !== currentMonth) return;

    const amount = Number(transaction.amount) || 0;

    if (transaction.type === "INCOME") {
      monthlyIncome += amount;
    }

    if (transaction.type === "EXPENSE") {
      monthlyExpense += amount;
    }
  });

  const monthlyNet = monthlyIncome - monthlyExpense;

  const savingsRate =
    monthlyIncome > 0 ? (monthlyNet / monthlyIncome) * 100 : 0;

  incomeElement.textContent = formatCurrency(monthlyIncome);
  expenseElement.textContent = formatCurrency(monthlyExpense);
  netElement.textContent = formatCurrency(monthlyNet);

  savingsElement.textContent = `${savingsRate.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })}%`;

  netElement.classList.toggle("report-negative", monthlyNet < 0);

  savingsElement.classList.toggle("report-negative", savingsRate < 0);

  // LAST SIX MONTHS
  const monthlyData = [];

  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(year, month - 1 - offset, 1);
    const monthKey = makeMonthKey(date);

    monthlyData.push({
      month: monthKey,
      label: getMonthLabel(monthKey, {
        month: "short",
        year: "2-digit",
      }),
      income: 0,
      expense: 0,
    });
  }

  const monthLookup = new Map(monthlyData.map((item) => [item.month, item]));

  transactions.forEach((transaction) => {
    const transactionMonth = String(transaction.date || "").slice(0, 7);

    const entry = monthLookup.get(transactionMonth);

    if (!entry) return;

    const amount = Number(transaction.amount) || 0;

    if (transaction.type === "INCOME") {
      entry.income += amount;
    }

    if (transaction.type === "EXPENSE") {
      entry.expense += amount;
    }
  });

  // DRAW MONTHLY BAR CHART
  chartContainer.innerHTML = "";

  const legend = document.createElement("div");
  legend.className = "report-chart-legend";

  [
    { label: "Income", className: "legend-income" },
    { label: "Expense", className: "legend-expense" },
  ].forEach((item) => {
    const entry = document.createElement("span");
    entry.className = "report-legend-item";

    const marker = document.createElement("span");
    marker.className = `report-legend-marker ${item.className}`;

    entry.append(marker, document.createTextNode(item.label));
    legend.appendChild(entry);
  });

  chartContainer.appendChild(legend);

  const chart = document.createElement("div");
  chart.className = "monthly-chart";

  const maxAmount = Math.max(
    1,
    ...monthlyData.flatMap((item) => [item.income, item.expense]),
  );

  monthlyData.forEach((item) => {
    const column = document.createElement("div");
    column.className = "monthly-chart-column";

    const bars = document.createElement("div");
    bars.className = "monthly-chart-bars";

    [
      {
        label: "Income",
        amount: item.income,
        className: "chart-bar-income",
      },
      {
        label: "Expense",
        amount: item.expense,
        className: "chart-bar-expense",
      },
    ].forEach((barData) => {
      const bar = document.createElement("div");
      bar.className = `monthly-chart-bar ${barData.className}`;

      const height =
        barData.amount > 0
          ? Math.max(3, (barData.amount / maxAmount) * 150)
          : 0;

      bar.style.height = `${height}px`;

      bar.title = `${barData.label}: ${formatCurrency(barData.amount)}`;

      bars.appendChild(bar);
    });

    const label = document.createElement("span");
    label.className = "monthly-chart-label";
    label.textContent = item.label;

    column.append(bars, label);
    chart.appendChild(column);
  });

  chartContainer.appendChild(chart);

  // EXPENSE BREAKDOWN BY CATEGORY
  categoryContainer.innerHTML = "";

  if (periodElement) {
    periodElement.textContent = getMonthLabel(currentMonth, {
      month: "long",
      year: "numeric",
    });
  }

  const categoryNames = new Map(
    (categories || []).map((category) => [
      category.category_id,
      category.category_name,
    ]),
  );

  const categoryTotals = new Map();

  transactions.forEach((transaction) => {
    if (
      String(transaction.date || "").slice(0, 7) !== currentMonth ||
      transaction.type !== "EXPENSE"
    ) {
      return;
    }

    const categoryId = transaction.category_id || "UNCATEGORIZED";

    const amount = Number(transaction.amount) || 0;

    categoryTotals.set(
      categoryId,
      (categoryTotals.get(categoryId) || 0) + amount,
    );
  });

  const breakdown = [...categoryTotals.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      name: categoryNames.get(categoryId) || categoryId,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalCategoryExpense = breakdown.reduce(
    (total, item) => total + item.amount,
    0,
  );

  if (breakdown.length === 0) {
    categoryContainer.textContent = "No expenses recorded for this month.";
  } else {
    breakdown.forEach((item) => {
      const percentage =
        totalCategoryExpense > 0
          ? (item.amount / totalCategoryExpense) * 100
          : 0;

      const row = document.createElement("div");
      row.className = "expense-category-row";

      const header = document.createElement("div");
      header.className = "expense-category-header";

      const name = document.createElement("span");
      name.className = "expense-category-name";
      name.textContent = item.name;

      const amount = document.createElement("strong");
      amount.textContent = formatCurrency(item.amount);

      header.append(name, amount);

      const track = document.createElement("div");
      track.className = "expense-category-track";

      const fill = document.createElement("div");
      fill.className = "expense-category-fill";
      fill.style.width = `${percentage}%`;

      track.appendChild(fill);

      const percentageLabel = document.createElement("p");
      percentageLabel.className = "expense-category-percentage";

      percentageLabel.textContent = `${percentage.toLocaleString("en-US", {
        maximumFractionDigits: 1,
      })}% of expenses`;

      row.append(header, track, percentageLabel);
      categoryContainer.appendChild(row);
    });
  }

  console.log("Reports rendered:", {
    currentMonth,
    monthlyIncome,
    monthlyExpense,
    monthlyNet,
    savingsRate,
    monthlyData,
    breakdown,
  });
};

// -------------------------
// ACCOUNTS & RECENT TRANSACTIONS
// -------------------------

function displayAccounts(accounts) {
  const container = getElement("accounts");

  if (!container) return;

  container.innerHTML = "";

  (Array.isArray(accounts) ? accounts : [])
    .filter((account) => isActive(account.active))
    .forEach((account) => {
      const element = document.createElement("div");
      element.className = "account";

      const info = document.createElement("div");

      const name = document.createElement("div");
      name.className = "account-name";
      name.textContent = account.account_name || account.account_id;

      const type = document.createElement("div");
      type.className = "account-type";
      type.textContent = account.account_type || "";

      info.append(name, type);

      const balance = document.createElement("div");
      balance.className = "account-balance";
      balance.textContent = formatCurrency(account.current_balance);

      element.append(info, balance);
      container.appendChild(element);
    });
}

function displayTransactions(transactions) {
  const container = getElement("transactions");

  if (!container) return;

  container.innerHTML = "";

  const recentTransactions = [
    ...(Array.isArray(transactions) ? transactions : []),
  ]
    .reverse()
    .slice(0, 10);

  recentTransactions.forEach((transaction) => {
    const element = document.createElement("div");
    element.className = "transaction";

    const info = document.createElement("div");
    info.className = "transaction-info";

    const description = document.createElement("strong");
    description.textContent =
      transaction.description || transaction.type || "Transaction";

    const type = document.createElement("span");
    type.textContent = transaction.type || "";

    info.append(description, type);

    const amount = document.createElement("div");

    let amountClass = "transaction-neutral";
    let prefix = "";

    if (transaction.type === "INCOME" || transaction.type === "TRANSFER_IN") {
      amountClass = "transaction-income";
      prefix = "+";
    } else if (
      transaction.type === "EXPENSE" ||
      transaction.type === "TRANSFER_OUT"
    ) {
      amountClass = "transaction-expense";
      prefix = "-";
    }

    amount.className = `transaction-amount ${amountClass}`;
    amount.textContent = `${prefix}${formatCurrency(transaction.amount)}`;

    element.append(info, amount);
    container.appendChild(element);
  });
}

// -------------------------
// EXPENSE FORM
// -------------------------

function displayExpenseAccounts(accounts) {
  const select = getElement("expense-account");

  if (!select) return;

  select.innerHTML = '<option value="">Select account</option>';

  (accounts || [])
    .filter((account) => isActive(account.active))
    .forEach((account) => {
      const option = document.createElement("option");
      option.value = account.account_id;

      option.textContent =
        `${account.account_name} — ` +
        `${formatCurrency(account.current_balance)}`;

      select.appendChild(option);
    });
}

function displayExpenseCategories(categories) {
  const select = getElement("expense-category");

  if (!select) return;

  select.innerHTML = '<option value="">Select category</option>';

  (categories || [])
    .filter(
      (category) =>
        isActive(category.active) &&
        String(category.category_type).toUpperCase() === "EXPENSE",
    )
    .forEach((category) => {
      const option = document.createElement("option");
      option.value = category.category_id;
      option.textContent = category.category_name;

      select.appendChild(option);
    });
}

async function addExpenseFromForm(event) {
  event.preventDefault();

  const amount = Number(getElement("expense-amount")?.value);

  const accountId = getElement("expense-account")?.value || "";

  const categoryId = getElement("expense-category")?.value || "";

  const transactionDate = getElement("expense-date")?.value || "";

  const description = getElement("expense-description")?.value.trim() || "";

  const status = getElement("expense-status");

  if (
    !accountId ||
    !categoryId ||
    !transactionDate ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    if (status) {
      status.textContent =
        "Please complete all required fields with a valid amount.";
    }

    return;
  }

  if (status) status.textContent = "Saving...";

  try {
    const result = await postData({
      action: "expense",
      accountId,
      categoryId,
      amount,
      transactionDate,
      description,
    });

    console.log("POST EXPENSE RESULT:", result);

    if (status) status.textContent = "Expense saved.";

    getElement("expense-form")?.reset();

    setDefaultTransactionDates();

    await loadDashboard();
  } catch (error) {
    console.error("EXPENSE ERROR:", error);

    if (status) {
      status.textContent = "Error: " + error.message;
    }
  }
}

// -------------------------
// INCOME FORM
// -------------------------

function displayIncomeAccounts(accounts) {
  const select = getElement("income-account");

  if (!select) return;

  select.innerHTML = '<option value="">Select account</option>';

  (accounts || [])
    .filter((account) => isActive(account.active))
    .forEach((account) => {
      const option = document.createElement("option");
      option.value = account.account_id;

      option.textContent =
        `${account.account_name} — ` +
        `${formatCurrency(account.current_balance)}`;

      select.appendChild(option);
    });
}

function displayIncomeCategories(categories) {
  const select = getElement("income-category");

  if (!select) return;

  select.innerHTML = '<option value="">Select income type</option>';

  (categories || [])
    .filter(
      (category) =>
        isActive(category.active) &&
        String(category.category_type).toUpperCase() === "INCOME",
    )
    .forEach((category) => {
      const option = document.createElement("option");
      option.value = category.category_id;
      option.textContent = category.category_name;

      select.appendChild(option);
    });
}

async function addIncomeFromForm(event) {
  event.preventDefault();

  const amount = Number(getElement("income-amount")?.value);

  const accountId = getElement("income-account")?.value || "";

  const categoryId = getElement("income-category")?.value || "";

  const transactionDate = getElement("income-date")?.value || "";

  const description = getElement("income-description")?.value.trim() || "";

  const status = getElement("income-status");

  if (
    !accountId ||
    !categoryId ||
    !transactionDate ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    if (status) {
      status.textContent =
        "Please complete all required fields with a valid amount.";
    }

    return;
  }

  if (status) status.textContent = "Saving...";

  try {
    const result = await postData({
      action: "income",
      accountId,
      categoryId,
      amount,
      transactionDate,
      description,
    });

    console.log("POST INCOME RESULT:", result);

    if (status) {
      status.textContent = result.distribution_applied
        ? "Income saved and distributed."
        : "Income saved.";
    }

    getElement("income-form")?.reset();

    setDefaultTransactionDates();

    await loadDashboard();
  } catch (error) {
    console.error("INCOME ERROR:", error);

    if (status) {
      status.textContent = "Error: " + error.message;
    }
  }
}

// -------------------------
// ACCOUNT / CATEGORY LOOKUPS
// -------------------------

function getAccountName(accountId) {
  if (!dashboardState) return accountId || "";

  const account = (dashboardState.accounts || []).find(
    (item) => item.account_id === accountId,
  );

  return account ? account.account_name : accountId || "";
}

function getCategoryName(categoryId) {
  if (!dashboardState || !categoryId) return "";

  const category = (dashboardState.categories || []).find(
    (item) => item.category_id === categoryId,
  );

  return category ? category.category_name : categoryId;
}

function formatTransactionDate(dateString) {
  if (!dateString) return "Date not set";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return String(dateString);
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// -------------------------
// TRANSACTION HISTORY
// -------------------------

function buildTransactionHistory(transactions) {
  const result = [];
  const processedTransfers = new Set();

  (Array.isArray(transactions) ? transactions : []).forEach((transaction) => {
    if (
      transaction.type !== "TRANSFER_OUT" &&
      transaction.type !== "TRANSFER_IN"
    ) {
      result.push({
        ...transaction,
        display_type: transaction.type,
      });

      return;
    }

    const referenceId = transaction.reference_id;

    if (!referenceId) {
      result.push({
        ...transaction,
        display_type: transaction.type,
      });

      return;
    }

    if (processedTransfers.has(referenceId)) return;

    const transferGroup = transactions.filter(
      (item) => item.reference_id === referenceId,
    );

    const transferOut = transferGroup.find(
      (item) => item.type === "TRANSFER_OUT",
    );

    const transferIn = transferGroup.find(
      (item) => item.type === "TRANSFER_IN",
    );

    if (transferOut && transferIn) {
      result.push({
        transaction_id: referenceId,
        date: transferOut.date,
        type: "TRANSFER",
        amount: transferOut.amount,
        description: transferOut.description || "Transfer",
        source_account_id: transferOut.account_id,
        destination_account_id: transferIn.account_id,
        category_id: transferOut.category_id || transferIn.category_id || "",
        reference_id: referenceId,
        display_type: "TRANSFER",
      });
    } else {
      result.push({
        ...transaction,
        display_type: transaction.type,
      });
    }

    processedTransfers.add(referenceId);
  });

  return result;
}

function displayTransactionHistory() {
  if (!dashboardState) return;

  const container = getElement("transaction-history");

  if (!container) {
    console.warn("Transaction history container not found.");
    return;
  }

  const searchInput = getElement("transaction-search");
  const typeSelect = getElement("transaction-type");
  const accountSelect = getElement("transaction-account");
  const categorySelect = getElement("transaction-category");

  const search = (searchInput?.value || "").toLowerCase().trim();

  const type = typeSelect?.value || "ALL";
  const accountId = accountSelect?.value || "ALL";
  const categoryId = categorySelect?.value || "ALL";

  let transactions = buildTransactionHistory(dashboardState.transactions || []);

  // SEARCH
  if (search) {
    transactions = transactions.filter((transaction) => {
      const description = String(transaction.description || "").toLowerCase();

      const accountName = String(
        getAccountName(transaction.account_id) || "",
      ).toLowerCase();

      const sourceName = String(
        getAccountName(transaction.source_account_id) || "",
      ).toLowerCase();

      const destinationName = String(
        getAccountName(transaction.destination_account_id) || "",
      ).toLowerCase();

      const categoryName = String(
        getCategoryName(transaction.category_id) || "",
      ).toLowerCase();

      const transactionType = String(
        transaction.display_type || transaction.type || "",
      ).toLowerCase();

      return (
        description.includes(search) ||
        accountName.includes(search) ||
        sourceName.includes(search) ||
        destinationName.includes(search) ||
        categoryName.includes(search) ||
        transactionType.includes(search)
      );
    });
  }

  // TYPE FILTER
  if (type !== "ALL") {
    transactions = transactions.filter(
      (transaction) => transaction.display_type === type,
    );
  }

  // ACCOUNT FILTER
  if (accountId !== "ALL") {
    transactions = transactions.filter((transaction) => {
      if (transaction.display_type === "TRANSFER") {
        return (
          transaction.source_account_id === accountId ||
          transaction.destination_account_id === accountId
        );
      }

      return transaction.account_id === accountId;
    });
  }

  // CATEGORY FILTER
  if (categoryId !== "ALL") {
    transactions = transactions.filter(
      (transaction) => transaction.category_id === categoryId,
    );
  }

  // SORT NEWEST FIRST
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = "";

  if (transactions.length === 0) {
    container.textContent = "No transactions found.";
    return;
  }

  // DISPLAY TRANSACTIONS
  transactions.forEach((transaction) => {
    const element = document.createElement("div");
    element.className = "transaction-history-item";

    const info = document.createElement("div");
    info.className = "transaction-history-info";

    const title = document.createElement("strong");
    title.textContent =
      transaction.display_type === "TRANSFER"
        ? "Transfer"
        : transaction.description || transaction.type || "Transaction";

    const meta = document.createElement("span");

    let accountName = "";
    let categoryName = "";

    if (transaction.display_type === "TRANSFER") {
      accountName =
        `${getAccountName(transaction.source_account_id)} → ` +
        `${getAccountName(transaction.destination_account_id)}`;
    } else {
      accountName = getAccountName(transaction.account_id);
      categoryName = getCategoryName(transaction.category_id);
    }

    let metaText = formatTransactionDate(transaction.date);

    if (accountName) {
      metaText += ` • ${accountName}`;
    }

    if (categoryName) {
      metaText += ` • ${categoryName}`;
    }

    meta.textContent = metaText;
    info.append(title, meta);

    // AMOUNT
    const amount = document.createElement("div");
    amount.className = "transaction-history-amount";

    if (transaction.display_type === "INCOME") {
      amount.classList.add("transaction-income");
      amount.textContent = "+" + formatCurrency(transaction.amount);
    } else if (transaction.display_type === "EXPENSE") {
      amount.classList.add("transaction-expense");
      amount.textContent = "-" + formatCurrency(transaction.amount);
    } else if (transaction.display_type === "TRANSFER") {
      amount.classList.add("transaction-neutral");
      amount.textContent = formatCurrency(transaction.amount);
    } else if (transaction.display_type === "TRANSFER_IN") {
      amount.classList.add("transaction-income");
      amount.textContent = "+" + formatCurrency(transaction.amount);
    } else if (transaction.display_type === "TRANSFER_OUT") {
      amount.classList.add("transaction-expense");
      amount.textContent = "-" + formatCurrency(transaction.amount);
    } else {
      amount.classList.add("transaction-neutral");
      amount.textContent = formatCurrency(transaction.amount);
    }

    element.append(info, amount);

    // EDIT / DELETE BUTTONS
    const canModify =
      (transaction.display_type === "EXPENSE" ||
        transaction.display_type === "INCOME") &&
      !transaction.reference_id;

    if (canModify) {
      const actions = document.createElement("div");
      actions.className = "transaction-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";

      editButton.addEventListener("click", () => {
        openEditTransaction(transaction);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", () => {
        deleteTransactionFromHistory(transaction);
      });

      actions.append(editButton, deleteButton);
      element.appendChild(actions);
    }

    container.appendChild(element);
  });
}

// -------------------------
// TRANSACTION FILTERS
// -------------------------

function displayTransactionAccountFilter(accounts) {
  const select = getElement("transaction-account");

  if (!select) return;

  const previousValue = select.value || "ALL";

  select.innerHTML = '<option value="ALL">All Accounts</option>';

  (accounts || [])
    .filter((account) => isActive(account.active))
    .forEach((account) => {
      const option = document.createElement("option");
      option.value = account.account_id;
      option.textContent = account.account_name;
      select.appendChild(option);
    });

  if ([...select.options].some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
}

function displayTransactionCategoryFilter(categories) {
  const select = getElement("transaction-category");

  if (!select) return;

  const previousValue = select.value || "ALL";

  select.innerHTML = '<option value="ALL">All Categories</option>';

  (categories || [])
    .filter((category) => isActive(category.active))
    .forEach((category) => {
      const option = document.createElement("option");
      option.value = category.category_id;
      option.textContent = category.category_name;
      select.appendChild(option);
    });

  if ([...select.options].some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
}

// -------------------------
// TRANSFER FORM
// -------------------------

function displayTransferAccounts(accounts) {
  const fromSelect = getElement("transfer-from");
  const toSelect = getElement("transfer-to");

  if (!fromSelect || !toSelect) return;

  const previousFrom = fromSelect.value;
  const previousTo = toSelect.value;

  fromSelect.innerHTML = '<option value="">Select source account</option>';

  toSelect.innerHTML = '<option value="">Select destination account</option>';

  (accounts || [])
    .filter((account) => isActive(account.active))
    .forEach((account) => {
      const fromOption = document.createElement("option");
      fromOption.value = account.account_id;

      fromOption.textContent =
        `${account.account_name} — ` +
        `${formatCurrency(account.current_balance)}`;

      fromSelect.appendChild(fromOption);

      const toOption = document.createElement("option");
      toOption.value = account.account_id;
      toOption.textContent = account.account_name;

      toSelect.appendChild(toOption);
    });

  if ([...fromSelect.options].some((option) => option.value === previousFrom)) {
    fromSelect.value = previousFrom;
  }

  if ([...toSelect.options].some((option) => option.value === previousTo)) {
    toSelect.value = previousTo;
  }
}

async function addTransferFromForm(event) {
  event.preventDefault();

  const fromAccountId = getElement("transfer-from")?.value || "";

  const toAccountId = getElement("transfer-to")?.value || "";

  const amount = Number(getElement("transfer-amount")?.value);

  const transactionDate = getElement("transfer-date")?.value || "";

  const description = getElement("transfer-description")?.value.trim() || "";

  const status = getElement("transfer-status");

  if (
    !fromAccountId ||
    !toAccountId ||
    !transactionDate ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    if (status) {
      status.textContent =
        "Please complete all required fields with a valid amount.";
    }

    return;
  }

  if (fromAccountId === toAccountId) {
    if (status) {
      status.textContent = "Source and destination cannot be the same.";
    }

    return;
  }

  if (status) status.textContent = "Transferring...";

  try {
    const result = await postData({
      action: "transfer",
      fromAccountId,
      toAccountId,
      amount,
      transactionDate,
      description,
    });

    console.log("POST TRANSFER RESULT:", result);

    if (status) {
      status.textContent = "Transfer successful.";
    }

    getElement("transfer-form")?.reset();

    setDefaultTransactionDates();

    await loadDashboard();
  } catch (error) {
    console.error("TRANSFER ERROR:", error);

    if (status) {
      status.textContent = "Error: " + error.message;
    }
  }
}

// -------------------------
// EDIT / DELETE TRANSACTIONS
// -------------------------

function displayEditAccounts(accounts) {
  const select = getElement("edit-account");

  if (!select) return;

  select.innerHTML = '<option value="">Select account</option>';

  (accounts || [])
    .filter((account) => isActive(account.active))
    .forEach((account) => {
      const option = document.createElement("option");
      option.value = account.account_id;
      option.textContent = account.account_name;

      select.appendChild(option);
    });
}

function displayEditCategories(categories, type) {
  const select = getElement("edit-category");

  if (!select) return;

  select.innerHTML = '<option value="">Select category</option>';

  (categories || [])
    .filter(
      (category) =>
        isActive(category.active) &&
        String(category.category_type).toUpperCase() ===
          String(type).toUpperCase(),
    )
    .forEach((category) => {
      const option = document.createElement("option");
      option.value = category.category_id;
      option.textContent = category.category_name;

      select.appendChild(option);
    });
}

function openEditTransaction(transaction) {
  if (transaction.reference_id) {
    alert("This transaction cannot be edited.");
    return;
  }

  const section = getElement("edit-section");
  const idInput = getElement("edit-transaction-id");
  const amountInput = getElement("edit-amount");
  const dateInput = getElement("edit-date");
  const accountSelect = getElement("edit-account");
  const categorySelect = getElement("edit-category");
  const descriptionInput = getElement("edit-description");
  const status = getElement("edit-status");

  if (
    !section ||
    !idInput ||
    !amountInput ||
    !dateInput ||
    !accountSelect ||
    !categorySelect ||
    !descriptionInput
  ) {
    console.error("One or more edit form elements are missing.");

    return;
  }

  idInput.value = transaction.transaction_id;
  amountInput.value = transaction.amount;

  dateInput.value = transaction.date
    ? String(transaction.date).substring(0, 10)
    : "";

  descriptionInput.value = transaction.description || "";

  displayEditAccounts(dashboardState.accounts);

  displayEditCategories(dashboardState.categories, transaction.display_type);

  accountSelect.value = transaction.account_id;
  categorySelect.value = transaction.category_id;

  if (status) status.textContent = "";

  section.hidden = false;

  section.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

async function submitEditTransaction(event) {
  event.preventDefault();

  const transactionId = getElement("edit-transaction-id")?.value || "";

  const amount = Number(getElement("edit-amount")?.value);

  const transactionDate = getElement("edit-date")?.value || "";

  const accountId = getElement("edit-account")?.value || "";

  const categoryId = getElement("edit-category")?.value || "";

  const description = getElement("edit-description")?.value.trim() || "";

  const status = getElement("edit-status");

  if (
    !transactionId ||
    !transactionDate ||
    !accountId ||
    !categoryId ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    if (status) {
      status.textContent =
        "Please complete all required fields with a valid amount.";
    }

    return;
  }

  if (status) status.textContent = "Saving...";

  try {
    const result = await updateTransaction(transactionId, {
      accountId,
      categoryId,
      amount,
      description,
      transactionDate,
    });

    console.log("UPDATE RESULT:", result);

    if (status) {
      status.textContent = "Transaction updated.";
    }

    const section = getElement("edit-section");

    if (section) {
      section.hidden = true;
    }

    await loadDashboard();
  } catch (error) {
    console.error("UPDATE ERROR:", error);

    if (status) {
      status.textContent = "Error: " + error.message;
    }
  }
}

function cancelEditTransaction() {
  const section = getElement("edit-section");

  if (section) {
    section.hidden = true;
  }
}

async function deleteTransactionFromHistory(transaction) {
  const transactionName = transaction.description || transaction.display_type;

  const confirmed = confirm(
    `Delete "${transactionName}"?\n\n` + "This action cannot be undone.",
  );

  if (!confirmed) return;

  try {
    console.log("Deleting transaction:", transaction.transaction_id);

    const result = await deleteTransaction(transaction.transaction_id);

    console.log("DELETE RESULT:", result);

    await loadDashboard();
  } catch (error) {
    console.error("DELETE ERROR:", error);

    alert("Failed to delete transaction:\n" + error.message);
  }
}

// -------------------------
// PAGE READY / EVENT LISTENERS
// -------------------------

document.addEventListener("DOMContentLoaded", () => {
  const listen = (id, eventName, handler) => {
    const element = getElement(id);

    if (element) {
      element.addEventListener(eventName, handler);
    } else {
      console.warn(`Element #${id} not found; skipped ${eventName} listener.`);
    }
  };

  listen("report-month-picker", "change", () => {
    const selectedMonth = getElement("report-month-picker")?.value;

    if (dashboardState && selectedMonth) {
      safeRender("filtered reports", () => {
        window.displayReports(
          dashboardState.transactions,
          dashboardState.categories,
          selectedMonth,
        );
      });
    }
  });

  listen("refresh-dashboard", "click", loadDashboard);
  listen("expense-form", "submit", addExpenseFromForm);
  listen("income-form", "submit", addIncomeFromForm);
  listen("transfer-form", "submit", addTransferFromForm);
  listen("salary-form", "submit", submitReceiveSalary);
  listen("refresh-pending-salaries", "click", loadPendingSalaries);
  listen("edit-form", "submit", submitEditTransaction);
  listen("cancel-edit", "click", cancelEditTransaction);

  listen("transaction-search", "input", displayTransactionHistory);

  listen("transaction-type", "change", displayTransactionHistory);

  listen("transaction-account", "change", displayTransactionHistory);

  listen("transaction-category", "change", displayTransactionHistory);

  setDefaultTransactionDates();
  setDefaultSalaryFields();

  loadDashboard();
});
