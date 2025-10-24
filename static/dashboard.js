// ====================== SpendSmart Dashboard Script ======================

// Global data
let transactions = [];
let budgets = {};
let chart;

// ====================== Initialize ======================
document.addEventListener("DOMContentLoaded", () => {
  loadTransactions();
  loadBudgets();

  document.getElementById("transactionForm").addEventListener("submit", addTransaction);
  document.getElementById("budgetForm").addEventListener("submit", setBudget);
});

// ====================== Load Transactions ======================
async function loadTransactions() {
  const res = await fetch("/get_transactions");
  const data = await res.json();
  transactions = data || [];

  renderTransactions();
  updateSummary();
  renderBudgetProgress();

  drawChart(); // always call; handles empty state safely
}

// ====================== Add Transaction ======================
async function addTransaction(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const obj = Object.fromEntries(formData.entries());

  const res = await fetch("/add_transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });

  if (res.ok) {
    form.reset();
    loadTransactions();
  } else {
    alert("Failed to add transaction.");
  }
}

// ====================== Delete Transaction ======================
async function deleteTransaction(id) {
  const res = await fetch(`/delete_transaction/${id}`, { method: "DELETE" });
  if (res.ok) loadTransactions();
}

// ====================== Edit Transaction ======================
function editTransaction(id) {
  const t = transactions.find(tr => tr.id === id);
  if (!t) return;

  const form = document.getElementById("transactionForm");
  form.amount.value = t.amount;
  form.type.value = t.type;
  form.category.value = t.category;
  form.date.value = t.date;

  const originalHandler = form.onsubmit;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const obj = Object.fromEntries(formData.entries());

    const res = await fetch(`/update_transaction/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });

    if (res.ok) {
      form.reset();
      form.onsubmit = originalHandler || addTransaction;
      loadTransactions();
    } else {
      alert("Failed to update transaction.");
    }
  };
}

// ====================== Update Summary ======================
function updateSummary() {
  const income = transactions.filter(t => t.type === "income")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const expense = transactions.filter(t => t.type === "expense")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  document.getElementById("incomeCard").textContent = `₹${income.toFixed(2)}`;
  document.getElementById("expenseCard").textContent = `₹${expense.toFixed(2)}`;
  document.getElementById("netCard").textContent = `₹${(income - expense).toFixed(2)}`;
}

// ====================== Render Transactions ======================
function renderTransactions() {
  const tbody = document.getElementById("transactionsTable");
  tbody.innerHTML = "";
  transactions.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>₹${parseFloat(t.amount).toFixed(2)}</td>
      <td>${t.type === "income" ? "💰 Income" : "💸 Expense"}</td>
      <td>${t.category}</td>
      <td>
        <button class="edit-btn" onclick="editTransaction(${t.id})">✏️</button>
        <button class="delete-btn" onclick="deleteTransaction(${t.id})">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ====================== Budget Management ======================
async function setBudget(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const obj = Object.fromEntries(formData.entries());

  const res = await fetch("/set_budget", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });

  if (res.ok) {
    form.reset();
    loadBudgets();
  } else {
    alert("Failed to set budget.");
  }
}

async function loadBudgets() {
  const res = await fetch("/get_budgets");
  const data = await res.json();
  budgets = data || {};
  renderBudgetProgress();
}

// ====================== Render Budget Progress ======================
function renderBudgetProgress() {
  const container = document.getElementById("budgetProgress");
  if (!container) return;
  container.innerHTML = "";

  for (let [category, limit] of Object.entries(budgets)) {
    const spent = transactions
      .filter(t => t.category === category && t.type === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const percent = ((spent / limit) * 100).toFixed(1);
    const div = document.createElement("div");
    div.className = "progress-item";
    div.innerHTML = `
      <strong>${category}</strong>: ₹${spent.toFixed(2)} / ₹${limit}
      <div class="progress-bar">
        <div class="progress-fill ${percent > 100 ? "over" : ""}" style="width:${Math.min(percent, 100)}%"></div>
      </div>`;
    container.appendChild(div);
  }
}

// ====================== Draw Expense Chart ======================
function drawChart() {
  const canvas = document.getElementById("expenseChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const expenses = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

  const labels = Object.keys(expenses);
  const values = Object.values(expenses);

  if (chart) chart.destroy();

  if (labels.length === 0) {
    // Clear and show message
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "16px Inter";
    ctx.fillStyle = "#888";
    ctx.textAlign = "center";
    ctx.fillText("No expense data yet", canvas.width / 2, canvas.height / 2);
    return;
  }

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: ["#4F46E5", "#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#10B981"],
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "Expense Breakdown by Category" }
      }
    }
  });
}
