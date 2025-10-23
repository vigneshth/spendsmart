from app import app, db, User, Expense

# Create application context
with app.app_context():
    # List all users
    print("----- Users -----")
    users = User.query.all()
    for user in users:
        print(f"ID: {user.id}, Username: {user.username}")

    # List all expenses
    print("\n----- Expenses -----")
    expenses = Expense.query.all()
    for exp in expenses:
        print(f"ID: {exp.id}, User_ID: {exp.user_id}, Category: {exp.category}, Amount: {exp.amount}, Description: {exp.description}")
