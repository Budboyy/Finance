const API_URL =
  "https://script.google.com/macros/s/AKfycbzMd9KvqK039AnwijinYWurkItGuNyKZP1kc9Kp3itqzqtapCqjT5-Ax6OVnpHqcq29Og/exec";

// =========================================
// GENERAL POST REQUEST
// Used for operations that may write data.
// Do not automatically retry these requests.
// =========================================

async function postData(data) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "API request failed.");
  }

  return result;
}

// =========================================
// SAFE READ REQUEST WITH ONE RETRY
// Used for dashboard and pending salaries.
// =========================================

async function postReadData(data) {
  const maxAttempts = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(data),
        cache: "no-store",
      });

      if (!response.ok) {
        const error = new Error(`HTTP error: ${response.status}`);

        error.retryable = [404, 429, 500, 502, 503, 504].includes(
          response.status,
        );

        throw error;
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "API request failed.");
      }

      return result;
    } catch (error) {
      lastError = error;

      const retryable = error instanceof TypeError || error.retryable === true;

      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      console.warn(
        `Read request failed on attempt ${attempt}. Retrying...`,
        error.message,
      );

      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  throw lastError;
}

// =========================================
// DASHBOARD
// =========================================

async function getDashboard() {
  return postReadData({
    action: "dashboard",
  });
}

// =========================================
// SALARY PAYDAY WORKFLOW
// =========================================

async function receiveSalary(data) {
  return postData({
    action: "receive_salary",
    salaryMonth: data.salaryMonth,
    receivedDate: data.receivedDate,
    amount: Number(data.amount),
    sourceAccountId: data.sourceAccountId || "ACC001",
    categoryId: data.categoryId,
    description: data.description || "",
  });
}

async function getPendingSalaries() {
  return postReadData({
    action: "pending_salaries",
  });
}

// =========================================
// DELETE TRANSACTION
// =========================================

async function deleteTransaction(transactionId) {
  return postData({
    action: "delete_transaction",
    transactionId: transactionId,
  });
}

// =========================================
// UPDATE TRANSACTION
// =========================================

async function updateTransaction(transactionId, data) {
  return postData({
    action: "update_transaction",
    transactionId: transactionId,
    accountId: data.accountId,
    categoryId: data.categoryId,
    amount: data.amount,
    description: data.description,
    transactionDate: data.transactionDate,
  });
}

async function previewSalaryDistribution(salaryId) {
  return postReadData({
    action: "preview_salary_distribution",
    salaryId: salaryId,
  });
}

async function distributePendingSalary(salaryId) {
  return postData({
    action: "distribute_pending_salary",
    salaryId: salaryId,
  });
}
