from flask import Flask, render_template, request, redirect, url_for, session, jsonify, abort, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
from sqlalchemy import text

# ---------------- App Setup ----------------
app = Flask(__name__)
app.secret_key = os.environ.get("SPENDSMART_SECRET", "spendsmart-dev-secret")

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "instance")
DB_FILE = os.path.join(DB_PATH, "spendsmart.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_FILE}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# ---------------- Models ----------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(160), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    transactions = db.relationship("Transaction", backref="user", lazy=True)
    budgets = db.relationship("Budget", backref="user", lazy=True)

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(20), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    date = db.Column(db.String(20), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(80), nullable=False)
    limit = db.Column(db.Float, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    __table_args__ = (db.UniqueConstraint("user_id", "category", name="uq_user_category"),)

# ---------------- Helpers ----------------
def login_required():
    return "user_id" in session

def get_current_user():
    if not login_required():
        return None
    return User.query.get(session["user_id"])

# ---------------- Frontend ----------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if not email or not password:
            flash("Email and password required.")
            return render_template("register.html")
        if User.query.filter_by(email=email).first():
            flash("Email already registered.")
            return render_template("register.html")
        user = User(email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        flash("Registration successful! Please login.")
        return redirect(url_for("login"))
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            session["user_id"] = user.id
            session["email"] = user.email
            return redirect(url_for("dashboard"))
        flash("Invalid credentials.")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully.")
    return redirect(url_for("index"))

@app.route("/dashboard")
def dashboard():
    if not login_required():
        return redirect(url_for("login"))
    return render_template("dashboard.html")

# ---------------------- Transactions CRUD ----------------------
@app.route("/get_transactions", methods=["GET"])
def get_transactions():
    if not login_required():
        return jsonify([])
    user = get_current_user()
    txs = Transaction.query.filter_by(user_id=user.id).order_by(Transaction.date.desc(), Transaction.id.desc()).all()
    out = [{"id": t.id, "amount": t.amount, "type": t.type, "category": t.category, "date": t.date} for t in txs]
    return jsonify(out)

@app.route("/add_transaction", methods=["POST"])
def add_transaction():
    if not login_required():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(force=True)
    try:
        amount = float(data.get("amount", 0))
        ttype = data.get("type", "").strip()
        category = data.get("category", "").strip() or "Other"
        date_str = data.get("date") or datetime.utcnow().strftime("%Y-%m-%d")
        if ttype not in ("income", "expense"):
            return jsonify({"error": "Invalid type"}), 400
    except Exception:
        return jsonify({"error": "Invalid payload"}), 400
    user = get_current_user()
    tx = Transaction(amount=amount, type=ttype, category=category, date=date_str, user_id=user.id)
    db.session.add(tx)
    db.session.commit()
    return jsonify({"message": "Transaction added", "id": tx.id}), 201

@app.route("/update_transaction/<int:tx_id>", methods=["PUT"])
def update_transaction(tx_id):
    if not login_required():
        return jsonify({"error": "Unauthorized"}), 401
    user = get_current_user()
    tx = Transaction.query.get_or_404(tx_id)
    if tx.user_id != user.id:
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json(force=True)
    if "amount" in data:
        try:
            tx.amount = float(data["amount"])
        except Exception:
            pass
    if "type" in data and data["type"] in ("income", "expense"):
        tx.type = data["type"]
    if "category" in data:
        tx.category = data["category"]
    if "date" in data:
        tx.date = data["date"]
    db.session.commit()
    return jsonify({"message": "Transaction updated"})

@app.route("/delete_transaction/<int:tx_id>", methods=["DELETE"])
def delete_transaction(tx_id):
    if not login_required():
        return jsonify({"error": "Unauthorized"}), 401
    user = get_current_user()
    tx = Transaction.query.get_or_404(tx_id)
    if tx.user_id != user.id:
        return jsonify({"error": "Forbidden"}), 403
    db.session.delete(tx)
    db.session.commit()
    return jsonify({"message": "Transaction deleted"})

# ---------------------- Budgets CRUD ----------------------
@app.route("/set_budget", methods=["POST"])
def set_budget():
    if not login_required():
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json(force=True)
    category = (data.get("category") or "Other").strip()
    try:
        limit = float(data.get("limit", 0))
    except Exception:
        return jsonify({"error": "Invalid limit"}), 400
    user = get_current_user()
    b = Budget.query.filter_by(user_id=user.id, category=category).first()
    if b:
        b.limit = limit
    else:
        b = Budget(category=category, limit=limit, user_id=user.id)
        db.session.add(b)
    db.session.commit()
    return jsonify({"message": "Budget set", "id": b.id})

@app.route("/get_budget", methods=["GET"])
def get_budget():
    if not login_required():
        return jsonify({})
    user = get_current_user()
    budgets = Budget.query.filter_by(user_id=user.id).all()
    return jsonify({b.category: b.limit for b in budgets})

@app.route("/delete_budget/<int:budget_id>", methods=["DELETE"])
def delete_budget(budget_id):
    if not login_required():
        return jsonify({"error": "Unauthorized"}), 401
    user = get_current_user()
    b = Budget.query.get_or_404(budget_id)
    if b.user_id != user.id:
        return jsonify({"error": "Forbidden"}), 403
    db.session.delete(b)
    db.session.commit()
    return jsonify({"message": "Budget deleted"})

# ---------------------- Database Initialization ----------------------
def ensure_db():
    os.makedirs(DB_PATH, exist_ok=True)
    recreate = False
    if os.path.exists(DB_FILE):
        try:
            with app.app_context():
                result = db.session.execute(text("PRAGMA table_info(user)")).fetchall()
                cols = [r[1] for r in result]
                if "password_hash" not in cols:
                    print("Column password_hash missing, recreating database...")
                    recreate = True
        except Exception as e:
            print("Error checking database:", e)
            recreate = True
    else:
        recreate = True

    if recreate:
        with app.app_context():
            db.drop_all()
            db.create_all()
            print("Database recreated successfully!")

# ---------------------- Run App ----------------------
if __name__ == "__main__":
    ensure_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
