from flask import Flask, request, jsonify
from flask_cors import CORS
import os, json, datetime, time, webbrowser, threading

# --- External Libraries ---
try:
    import pyttsx3
except ImportError:
    pyttsx3 = None
    print("Warning: pyttsx3 (TTS) not installed. Text-to-Speech functionality disabled.")

try:
    import pywhatkit as kit
except ImportError:
    kit = None
    print("Warning: pywhatkit not installed. WhatsApp functionality disabled.")

try:
    import pyautogui
except ImportError:
    pyautogui = None

try:
    import winsound
except ImportError:
    winsound = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None
    print("Warning: google-generativeai not installed. AI/Study mode will use mock response.")

app = Flask(__name__)
CORS(app)

# ---------- Data Persistence Setup ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
FILES = {
    "transactions": os.path.join(DATA_DIR, "transactions.json"),
    "budgets": os.path.join(DATA_DIR, "budgets.json"),
    "goals": os.path.join(DATA_DIR, "goals.json"),
}

os.makedirs(DATA_DIR, exist_ok=True)
for p in FILES.values():
    if not os.path.exists(p):
        with open(p, "w", encoding="utf-8") as fp:
            fp.write("[]")

def read_json(path):
    try:
        with open(path, "r", encoding="utf-8") as fp:
            return json.load(fp)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def write_json(path, data):
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(data, fp, indent=4, ensure_ascii=False)

# ---------- TTS ----------
tts_engine = None
if pyttsx3:
    try:
        tts_engine = pyttsx3.init()
    except Exception as e:
        print(f"Error initializing TTS engine: {e}")

def speak(text):
    if not tts_engine:
        return
    try:
        def run_tts():
            try:
                tts_engine.say(str(text))
                tts_engine.runAndWait()
            except Exception:
                pass
        threading.Thread(target=run_tts).start()
    except Exception:
        pass

# ---------- Gemini AI ----------
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
AI_ENABLED = genai and GEMINI_KEY

if AI_ENABLED:
    try:
        genai.configure(api_key=GEMINI_KEY)
        print("Gemini AI configured for Study Mode.")
    except Exception as e:
        AI_ENABLED = False
        print(f"Error configuring Gemini: {e}. AI disabled.")
else:
    print("Gemini AI not configured. Using mock responses for Study Mode.")

def ask_gemini_short(prompt):
    if not AI_ENABLED:
        return "AI response (MOCK): The capital of France is Paris. The Eiffel Tower is a landmark located there."
    system_instruction = "You are a concise, helpful study assistant. Answer in 2-3 sentences."
    try:
        model = genai.GenerativeModel("gemini-2.0-flash", system_instruction=system_instruction)
        response = model.generate_content(prompt)
        text = response.text or ""
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        return " ".join(lines[:3]) or text.strip()
    except Exception as e:
        return f"AI Error: {e}"

# ---------- Finance Parser ----------
def parse_finance(text):
    t = text.lower().strip()
    tokens = t.split()
    if tokens and tokens[0] in ("add", "create") and len(tokens) >= 3:
        ttype = "Expense" if tokens[1] == "expense" else "Income"
        try:
            amt = float(tokens[2])
        except:
            return {"error": "Invalid amount provided."}
        if ttype == "Expense":
            amt = -abs(amt)
        category = tokens[3] if len(tokens) > 3 else "Other"
        desc = " ".join(tokens[4:]) if len(tokens) > 4 else f"{ttype} {category}"
        tx = {
            "date": datetime.date.today().isoformat(),
            "desc": desc,
            "category": category,
            "amount": amt,
            "type": ttype
        }
        return {"action": "create", "data": tx}
    if tokens and tokens[0] in ("delete", "remove") and len(tokens) >= 3:
        ttype = "Expense" if tokens[1] == "expense" else "Income"
        try:
            amt = float(tokens[2])
        except:
            return {"error": "Invalid amount for delete."}
        category = tokens[3] if len(tokens) > 3 else "Other"
        return {"action": "delete", "data": {"type": ttype, "amount": amt, "category": category}}
    if "balance" in t or "net worth" in t:
        return {"action": "balance"}
    if "expenses" in t or "total expenses" in t or "spend" in t:
        return {"action": "expenses"}
    return {"error": "unknown"}

# ---------- Assistant Parser ----------
CONTACTS = {"me":"+919",
            "gurpal":"+918"}

def parse_assistant_command(text):
    t = (text or "").strip().lower()
    if "open youtube" in t or t.startswith("youtube"):
        # Check if it's a search
        if "search" in t:
            query = t.split("search", 1)[1].strip()
            if query:
                url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
                return {"action": "open_url", "url": url, "reply": f"Searching YouTube for '{query}'"}
        return {"action": "open_url", "url": "https://www.youtube.com", "reply": "Opening YouTube"}
    if "open google" in t:
        if "search" in t:
            query = t.split("search", 1)[1].strip()
            if query:
                url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
                return {"action": "open_url", "url": url, "reply": f"Searching Google for '{query}'"}
        return {"action": "open_url", "url": "https://www.google.com", "reply": "Opening Google"}

    if "open linkedin" in t:
        return {"action": "open_url", "url": "https://www.linkedin.com"}
    
    if "message to" in t or "send message to" in t:
        parts = t.replace("send message to", "message to").split("message to", 1)
        if len(parts) < 2:
            return {"action": "unknown"}
        parts = parts[1].strip()
        if ":" in parts:
            name, msg = parts.split(":", 1)
        else:
            tokens = parts.split(maxsplit=1)
            name = tokens[0] if tokens else ""
            msg = tokens[1] if len(tokens) > 1 else ""
        name = name.strip()
        msg = msg.strip()
        if not name:
            return {"action": "unknown", "detail": "Missing contact name"}
        if not msg:
            return {"action": "ask_for_message", "contact": name}
        return {"action": "whatsapp", "contact": name, "message": msg}
    return {"action": "unknown"}

def send_whatsapp_message(contact_key, message):
    if kit is None:
        return {"reply": "WhatsApp feature disabled."}
    number = CONTACTS.get(contact_key.lower())
    if not number:
        names = ", ".join(CONTACTS.keys())
        return {"reply": f"Unknown contact '{contact_key}'. Known contacts: {names}"}
    try:
        if hasattr(kit, "sendwhatmsg_instantly"):
            kit.sendwhatmsg_instantly(number, message, wait_time=10, tab_close=True)
            return {"reply": f"WhatsApp sent instantly to {contact_key}."}
        else:
            now = datetime.datetime.now()
            hour = now.hour
            minute = (now.minute + 1) % 60
            kit.sendwhatmsg(number, message, hour, minute)
            def press_enter_after_delay():
                time.sleep(10)
                if pyautogui:
                    try:
                        pyautogui.press("enter")
                    except:
                        pass
            threading.Thread(target=press_enter_after_delay).start()
            return {"reply": f"WhatsApp scheduled for {hour}:{minute:02d} to {contact_key}."}
    except Exception as e:
        return {"reply": f"pywhatkit error: {e}"}

# ---------- CRUD Endpoints ----------
@app.get("/api/transactions")
def get_transactions():
    # ✅ return contains "status" key for React
    return jsonify({"status": True, "data": read_json(FILES["transactions"])})

@app.post("/api/transactions")
def post_transaction():
    tx = request.json or {}
    if not tx.get("desc") or tx.get("amount") is None:
        return jsonify({"status": False, "message": "Invalid data"}), 400
    
    data = read_json(FILES["transactions"])

    # ✅ generate id
    tx["id"] = int(datetime.datetime.now().timestamp() * 1000)

    data.append(tx)
    write_json(FILES["transactions"], data)

    # ✅ return "status" so frontend doesn't fail
    return jsonify({"status": True, "message": "Transaction added", "data": tx})

@app.delete("/api/transactions/<int:tx_id>")
def del_transaction(tx_id):
    data = read_json(FILES["transactions"])
    for i, t in enumerate(data):
        if t["id"] == tx_id:
            data.pop(i)
            write_json(FILES["transactions"], data)
            return jsonify({"status": True, "message": "Transaction deleted"})
    
    # ✅ return 404 properly
    return jsonify({"status": False, "message": "Transaction not found"}), 404

# ✅ Modify / Update Transaction endpoint added
@app.put("/api/transactions/<int:tx_id>")
def update_transaction(tx_id):
    updated = request.json or {}
    data = read_json(FILES["transactions"])

    for i, t in enumerate(data):
        if t["id"] == tx_id:
            data[i].update(updated)
            write_json(FILES["transactions"], data)

            # ✅ return status for React
            return jsonify({"status": True, "message": "Transaction updated", "data": data[i]})

    return jsonify({"status": False, "message": "Transaction not found"}), 404
# ------------------------------budget
BUDGETS_FILE = FILES["budgets"]
TRANSACTIONS_FILE = FILES["transactions"]


# Read budgets.json safely
def read_budgets():
    if not os.path.exists(BUDGETS_FILE):
        return []
    with open(BUDGETS_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


# Write budgets.json safely
def write_budgets(data):
    with open(BUDGETS_FILE, "w") as f:
        json.dump(data, f, indent=2)


# Read transactions.json safely
def read_transactions():
    if not os.path.exists(TRANSACTIONS_FILE):
        return []
    with open(TRANSACTIONS_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

@app.post("/api/budgets/update")
def update_budget_limits():
    """
    Expects JSON array of budgets:
    [
        {"category": "Food & Dining", "limit": 5000, ...},
        {"category": "Entertainment", "limit": 2000, ...},
        ...
    ]
    """
    try:
        updated_budgets = request.get_json()
        if not isinstance(updated_budgets, list):
            return jsonify({"status": False, "message": "Invalid payload"}), 400

        # Read existing budgets
        budgets = read_budgets()

        # Update limits for existing categories or add new ones
        budget_dict = {b["category"]: b for b in budgets}
        for b in updated_budgets:
            category = b.get("category")
            limit = b.get("limit")
            if not category or limit is None:
                continue
            if category in budget_dict:
                budget_dict[category]["limit"] = limit
            else:
                # Add new budget if it doesn't exist
                budget_dict[category] = {
                    "category": category,
                    "limit": limit,
                    "spent": 0,
                    "percentage": 0
                }

        # Save updated budgets
        write_budgets(list(budget_dict.values()))
        return jsonify({"status": True, "data": list(budget_dict.values())})
    except Exception as e:
        return jsonify({"status": False, "message": str(e)}), 500
@app.get("/api/budgets")
def get_budget_structure():
    transactions = read_transactions()
    budgets = read_budgets()

    # Normalize categories
    def normalize_category(category):
        if not category:
            return "Other"
        c = category.lower()
        if "food" in c or "grocer" in c or c == "drink": return "Food & Dining"
        if "entertain" in c: return "Entertainment"
        if "transport" in c: return "Transportation"
        if "hous" in c: return "Housing"
        if "util" in c: return "Utilities"
        return category

    # Calculate spent per category
    spent = {}
    for tx in transactions:
        if tx.get("type") == "Expense":
            cat = normalize_category(tx.get("category"))
            spent[cat] = spent.get(cat, 0) + abs(tx.get("amount", 0))

    # ✅ Add new categories if missing in budgets.json
    existing = {b["category"] for b in budgets}
    for cat in spent.keys():
        if cat not in existing:
            budgets.append({
                "category": cat,
                "limit": 500  # default limit
            })

    # ✅ Merge limits from budgets.json and spent from transactions.json
    result = []
    for b in budgets:
        limit = b.get("limit", 0)
        s = spent.get(b["category"], 0)

        result.append({
            "id": b.get("id", b["category"]),
            "category": b["category"],
            "limit": limit,
            "spent": s,
            "percentage": round((s / limit) * 100, 2) if limit else 0
        })

    # ✅ save updated category list back to budgets.json (limits preserved)
    write_budgets(budgets)

    return jsonify({"status": True, "data": result})


# Allow user to update limit
@app.post("/api/budgets/update")
def update_budget_limit():
    body = request.json or {}
    cat = body.get("category")
    new_limit = body.get("limit")

    if not cat or new_limit is None or new_limit < 0:
        return jsonify({"status": False, "message": "Invalid budget limit"}), 400

    budgets = read_budgets()

    updated = False
    for b in budgets:
        if b["category"] == cat:
            b["limit"] = new_limit
            updated = True

    if not updated:
        budgets.append({"category": cat, "limit": new_limit})

    write_budgets(budgets)
    return jsonify({"status": True, "data": budgets})


# Optional: delete budget category
@app.delete("/api/budgets/<string:cat_name>")
def delete_budget(cat_name):
    budgets = read_budgets()
    updated = [b for b in budgets if b["category"] != cat_name]

    if len(updated) == len(budgets):
        return jsonify({"status": False, "message": "Category not found"}), 404

    write_budgets(updated)
    return jsonify({"status": True, "message": "Budget category deleted"})
    

# ------ GOALS (Complete) ------

GOALS_FILE = FILES["goals"]

def read_goals():
    with open(GOALS_FILE, "r") as f:
        return json.load(f)

def write_goals(data):
    with open(GOALS_FILE, "w") as f:
        json.dump(data, f, indent=2)

@app.get("/api/goals")
def get_goals():
    return jsonify({
        "status": True,
        "data": read_goals()
    })

@app.post("/api/goals")
def post_goal():
    new = request.json or {}
    data = read_goals()
    new["id"] = int(datetime.datetime.now().timestamp() * 1000)
    new["saved"] = 0
    if "dueDate" not in new:
        new["dueDate"] = ""
    data.append(new)
    write_goals(data)
    return jsonify({"status": True, "data": new})

@app.patch("/api/goals/<int:goal_id>/add")
def add_to_goal(goal_id):
    body = request.json or {}
    amount = body.get("amount", 0)
    data = read_goals()
    for i, g in enumerate(data):
        if g["id"] == goal_id:
            g["saved"] = min(g["saved"] + amount, g["target"])
            data[i] = g
            write_goals(data)
            return jsonify({"status": True, "data": g})
    return jsonify({"status": False, "message": "Goal not found"}), 404

@app.delete("/api/goals/<int:goal_id>")
def delete_goal(goal_id):
    data = read_goals()  # read current goals from JSON
    updated = [g for g in data if g["id"] != goal_id]

    if len(updated) == len(data):
        return jsonify({"status": False, "message": "Goal not found"}), 404

    write_goals(updated)  # write back the updated array
    return jsonify({"status": True, "message": "Goal deleted"})


# ---------- Assistant Endpoint ----------
@app.post("/assistant")
def assistant_endpoint():
    body = request.json or {}
    text = body.get("text", "")
    mode = (body.get("mode") or "").lower()
    if not text:
        return jsonify({"reply": "Please provide a query."}), 400

    # Finance mode
    if mode == "finance":
        p = parse_finance(text)
        if p.get("error") and p["error"] == "unknown":
            return jsonify({"reply": "Finance command not recognized."}), 400
        if p.get("error"):
            return jsonify({"reply": f"Finance Parse Error: {p['error']}"}), 400
        action = p.get("action")
        if action == "create":
            tx = p["data"]
            data = read_json(FILES["transactions"])
            tx["id"] = int(datetime.datetime.now().timestamp() * 1000)
            data.append(tx)
            write_json(FILES["transactions"], data)
            speak(f"{tx['type']} of {abs(tx['amount'])} added.")
            return jsonify({"reply": f"Added {tx['type']}: {tx['desc']} ({tx['amount']})"})
        if action == "balance":
            data = read_json(FILES["transactions"])
            bal = sum(t["amount"] for t in data)
            reply_text = f"Your balance is ₹{bal:.2f}"
            speak(reply_text)
            return jsonify({"reply": reply_text})
        if action == "expenses":
            data = read_json(FILES["transactions"])
            exp = sum(t["amount"] for t in data if t.get("amount", 0) < 0)
            reply_text = f"Total expenses: ₹{abs(exp):.2f}"
            speak(reply_text)
            return jsonify({"reply": reply_text})
        if action == "delete":
            tx_to_delete = p["data"]
            data = read_json(FILES["transactions"])
            deleted = None
            for i, tx in enumerate(data):
                if tx["type"] == tx_to_delete["type"] and tx["amount"] == tx_to_delete["amount"]:
                    deleted = data.pop(i)
                    break

            if deleted:
                write_json(FILES["transactions"], data)
                speak(f"{deleted['type']} of {abs(deleted['amount'])} deleted.")
                return jsonify({"reply": f"Deleted {deleted['type']} {deleted['amount']} ({deleted['desc']})"})
            else:
                return jsonify({"reply": "Transaction not found."})
    # Assistant mode
    if mode == "assistant":
        cmd = parse_assistant_command(text)
        action = cmd["action"]
        if action == "open_url":
            url = cmd["url"]
            try:
                webbrowser.open(url)
                return jsonify({"reply": f"Opened {url}."})
            except Exception as e:
                return jsonify({"reply": f"Failed to open {url}: {e}"}), 500
        if action == "play_sound":
            if winsound:
                sound_file = cmd.get("file")
                try:
                    winsound.PlaySound(sound_file, winsound.SND_FILENAME | winsound.SND_ASYNC)
                    return jsonify({"reply": f"Playing sound (if '{sound_file}' exists)."})
                except Exception as e:
                    return jsonify({"reply": f"Failed to play sound: {e}"}), 500
            else:
                return jsonify({"reply": "Sound playback unavailable."})
        if action == "ask_for_message":
            return jsonify({"reply": f"Please provide the message to send to {cmd.get('contact')}."})
        if action == "whatsapp":
            result = send_whatsapp_message(cmd.get("contact"), cmd.get("message"))
            return jsonify(result)
        return jsonify({"reply": "Assistant command not recognized."}), 400

    # Study mode
    if mode == "study":
        short_answer = ask_gemini_short(text)
        speak(short_answer)
        return jsonify({"reply": short_answer})

    return jsonify({"reply": "Select a mode (finance, assistant, study)."}), 400

# ---------- Voice Endpoint ----------
@app.post("/assistant/voice")
def assistant_voice_endpoint():
    body = request.json or {}
    text = body.get("text", "")
    mode = (body.get("mode") or "").lower()
    with app.test_request_context(json={"text": text, "mode": mode}):
        return assistant_endpoint()

if __name__ == "__main__":
    print("Starting Assistant Server on port 8000...")
    app.run(host="0.0.0.0", port=8000, debug=True)
