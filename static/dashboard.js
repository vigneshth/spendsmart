const expenseList = document.getElementById("expenseList");
const totalDisplay = document.getElementById("totalExpense");
const filterInput = document.getElementById("filterCategory");
const ctx = document.getElementById("expenseChart").getContext("2d");

// Calculate total expenses
function calculateTotal() {
    let total = 0;
    const items = expenseList.querySelectorAll("li");
    items.forEach(item => {
        if (item.style.display !== "none") total += parseFloat(item.dataset.amount);
    });
    totalDisplay.textContent = total.toFixed(2);
}

// Filter by category
filterInput.addEventListener("input", () => {
    const filter = filterInput.value.toLowerCase();
    const items = expenseList.querySelectorAll("li");
    items.forEach(item => {
        const category = item.dataset.category.toLowerCase();
        item.style.display = category.includes(filter) ? "flex" : "none";
    });
    calculateTotal();
    updateChart();
});

// Sort expenses
let ascending = true;
function sortExpenses() {
    const items = Array.from(expenseList.querySelectorAll("li"));
    items.sort((a,b)=> ascending ? a.dataset.amount-b.dataset.amount : b.dataset.amount-a.dataset.amount);
    items.forEach(item => expenseList.appendChild(item));
    ascending = !ascending;
    updateChart();
}

// Prepare chart data
function getCategoryData() {
    const data = {};
    const items = expenseList.querySelectorAll("li");
    items.forEach(item => {
        if(item.style.display!=="none") {
            const cat=item.dataset.category, amt=parseFloat(item.dataset.amount);
            data[cat]=(data[cat]||0)+amt;
        }
    });
    return data;
}

// Chart.js
let chart = new Chart(ctx, {
    type:'pie',
    data:{ labels:[], datasets:[{label:'Expenses by Category', data:[], backgroundColor:['#3498db','#e74c3c','#2ecc71','#f1c40f','#9b59b6','#1abc9c','#e67e22'], borderColor:'#fff', borderWidth:1 }] },
    options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
});

function updateChart(){
    const categoryData = getCategoryData();
    chart.data.labels = Object.keys(categoryData);
    chart.data.datasets[0].data = Object.values(categoryData);
    chart.update();
}

// Initial
calculateTotal();
updateChart();
