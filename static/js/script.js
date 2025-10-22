// Confirm before adding transaction
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form[action='/add']");
    if (form) {
        form.addEventListener("submit", (e) => {
            const type = form.querySelector("input[name='type']").value.trim().toLowerCase();
            const amount = form.querySelector("input[name='amount']").value.trim();

            if (type !== "income" && type !== "expense") {
                e.preventDefault();
                alert("Type must be either 'income' or 'expense'");
                return;
            }

            if (isNaN(amount) || amount <= 0) {
                e.preventDefault();
                alert("Amount must be a positive number");
                return;
            }

            const category = form.querySelector("input[name='category']").value.trim();
            if (category === "") {
                e.preventDefault();
                alert("Category cannot be empty");
                return;
            }

            alert(`Transaction Added: ${type} ₹${amount} (${category})`);
        });
    }
});
