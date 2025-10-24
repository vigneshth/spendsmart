import os

db_path = "spendsmart.db"  # or adjust path if your DB is elsewhere
if os.path.exists(db_path):
    os.remove(db_path)
    print("Old database deleted.")
else:
    print("Database file not found.")
