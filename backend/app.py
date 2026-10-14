import os
import datetime
import time
import webbrowser
import threading
import json
import urllib.request
import urllib.error
from functools import wraps

from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client

# --- Always load .env from the backend directory first, then fallback to cwd ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()

# --- Optional / platform-specific libraries ---
try:
    import pyttsx3
except ImportError:
    pyttsx3 = None

try:
    import pywhatkit as kit
except ImportError:
    kit = None

try:
    import pyautogui
except ImportError:
    pyautogui = None

try:
    import winsound
except ImportError:
    winsound = None

# Official Google GenAI SDK (google-genai v2.30+)
try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:
    genai = None
    genai_types = None

legacy_genai = None
if not genai:
    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            import google.generativeai as legacy_genai
    except ImportError:
        legacy_genai = None

static_folder_path = os.path.join(BASE_DIR, "static")
os.makedirs(static_folder_path, exist_ok=True)

app = Flask(__name__, static_folder=static_folder_path, static_url_path="")
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
)

# ============================================================
# Supabase setup (Postgres storage + Auth)
# ============================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "").strip()

_base_client: Client = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        _base_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
else:
    print("Warning: SUPABASE_URL and SUPABASE_ANON_KEY are not set in .env")


def get_scoped_client(access_token: str) -> Client:
    """Returns a Supabase client stamped with the caller's JWT for RLS."""
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(access_token)
    return client


def require_auth(f):
    """Verifies 'Authorization: Bearer <token>' and attaches g.user / g.token / g.db."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return jsonify({"status": True}), 200

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"status": False, "message": "Missing Authorization Bearer token"}), 401
        token = auth_header.split(" ", 1)[1].strip()

        if not _base_client:
            return jsonify({"status": False, "message": "Supabase client is not configured on server"}), 500

        try:
            user_resp = _base_client.auth.get_user(token)
            user = user_resp.user if hasattr(user_resp, "user") else None
        except Exception as e:
            return jsonify({"status": False, "message": f"Invalid or expired token: {e}"}), 401

        if not user:
            return jsonify({"status": False, "message": "Invalid or expired token"}), 401

        g.user = user
        g.token = token
        g.db = get_scoped_client(token)
        return f(*args, **kwargs)
    return wrapper


# ============================================================
# TTS (Text to Speech on server hardware if available)
# ============================================================
tts_engine = None
if pyttsx3:
    try:
        tts_engine = pyttsx3.init()
    except Exception as e:
        print(f"Error initializing TTS engine: {e}")


def speak(text):
    """Asynchronous server TTS (does not block, safe on headless/cloud)"""
    if not tts_engine:
        return
    try:
        def run_tts():
            try:
                tts_engine.say(str(text))
                tts_engine.runAndWait()
            except Exception:
                pass
        threading.Thread(target=run_tts, daemon=True).start()
    except Exception:
        pass


# ============================================================
# Gemini AI for Study Mode (Model Discovery & Learning Tutor)
# ============================================================
STUDY_MODE_SYSTEM_INSTRUCTION = (
    "You are an encouraging, expert tutor and study assistant. "
    "When answering queries in Study Mode, guide the student with a comprehensive, learning-focused response that includes:\n"
    "1. **Core Concept Overview**: A clear, intuitive explanation.\n"
    "2. **Step-by-Step Breakdown**: Logical explanation or problem-solving walkthrough.\n"
    "3. **Concrete Example / Analogy**: A practical real-world scenario, calculation, or code example.\n"
    "4. **Key Takeaways & Hints**: Crucial tips, memory aids, or common pitfalls.\n"
    "5. **Check for Understanding**: A quick question or challenge to help the student test their knowledge.\n\n"
    "Use clean markdown formatting with bold headings and bullet points. Be thorough and educational."
)

_cached_supported_models = None
_cached_models_time = 0


def discover_supported_models(api_key: str) -> list:
    """
    Queries Google's ListModels API to discover all available models that support
    'generateContent' for this key. Caches the result in memory for 10 minutes.
    Never exposes or logs the API key.
    """
    global _cached_supported_models, _cached_models_time
    now = time.time()
    if _cached_supported_models and (now - _cached_models_time < 600):
        return _cached_supported_models

    discovered = []

    # 1. Try google-genai SDK
    if genai:
        try:
            client = genai.Client(api_key=api_key)
            for m in client.models.list():
                methods = (
                    getattr(m, "supported_generation_methods", None)
                    or getattr(m, "supported_actions", [])
                    or []
                )
                name = getattr(m, "name", "") or ""
                clean_name = name.replace("models/", "").strip()
                if not methods or "generateContent" in methods:
                    if clean_name and clean_name not in discovered:
                        discovered.append(clean_name)
        except Exception:
            pass

    # 2. Try REST ListModels if SDK returned empty
    if not discovered:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for m in data.get("models", []):
                    methods = m.get("supportedGenerationMethods", [])
                    name = m.get("name", "")
                    clean_name = name.replace("models/", "").strip()
                    if "generateContent" in methods:
                        if clean_name and clean_name not in discovered:
                            discovered.append(clean_name)
        except Exception:
            pass

    if discovered:
        _cached_supported_models = discovered
        _cached_models_time = now

    return discovered or []


def ask_gemini_study(prompt: str) -> str:
    """Answers study queries using Gemini AI with robust model discovery, verification, and diagnostics."""
    # Ensure backend/.env is loaded
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path, override=True)

    key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    configured_model = (os.environ.get("GEMINI_MODEL") or "gemini-3.5-flash-lite").strip()
    configured_model = configured_model.replace("models/", "").strip()

    if not key:
        return (
            "Study Mode is inactive: GEMINI_API_KEY is not set.\n\n"
            "To fix this:\n"
            "1. Visit https://aistudio.google.com/app/apikey (Free)\n"
            "2. Generate an API Key (starts with 'AIzaSy...')\n"
            "3. Add GEMINI_API_KEY=your_key in backend/.env and restart the server."
        )

    # Step 1: Discover supported models via ListModels API
    supported_models = discover_supported_models(key)

    # Step 2: Build candidate list in order of preference
    candidates = []
    if configured_model:
        if not supported_models or configured_model in supported_models:
            candidates.append(configured_model)
        else:
            print(f"[Gemini] Configured model '{configured_model}' not in supported models list for this key.")

    default_fallbacks = [
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-3.5-flash",
    ]

    for fb in default_fallbacks:
        if (not supported_models or fb in supported_models) and fb not in candidates:
            candidates.append(fb)

    if not candidates and supported_models:
        candidates = supported_models[:3]

    if not candidates:
        candidates = ["gemini-3.5-flash-lite", "gemini-2.5-flash"]

    last_error_code = None
    last_error_msg = ""
    attempted_models = []

    for target_model in candidates:
        attempted_models.append(target_model)

        # 1. Try modern google-genai SDK
        if genai:
            try:
                client = genai.Client(api_key=key)
                config = (
                    genai_types.GenerateContentConfig(
                        system_instruction=STUDY_MODE_SYSTEM_INSTRUCTION
                    )
                    if genai_types
                    else None
                )
                resp = client.models.generate_content(
                    model=target_model,
                    contents=prompt,
                    config=config,
                )
                text = (resp.text or "").strip()
                if text:
                    return text
            except Exception as sdk_err:
                err_text = str(sdk_err)
                if "404" in err_text or "NOT_FOUND" in err_text:
                    print(f"[Gemini SDK] Model '{target_model}' returned 404 NOT_FOUND. Trying next model...")
                    last_error_code = 404
                    last_error_msg = f"Model '{target_model}' not found"
                    continue
                if "429" in err_text or "RESOURCE_EXHAUSTED" in err_text:
                    last_error_code = 429
                    last_error_msg = "Rate limit / quota exceeded"
                    print(f"[Gemini SDK] Quota exceeded on '{target_model}'. Trying next model...")
                    continue
                print(f"[Gemini SDK] Model '{target_model}' error: {err_text}. Trying REST API...")

        # 2. Try REST API fallback
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={key}"
            payload = {
                "systemInstruction": {
                    "parts": [{"text": STUDY_MODE_SYSTEM_INSTRUCTION}]
                },
                "contents": [{"parts": [{"text": prompt}]}],
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                candidates_data = res_data.get("candidates") or []
                if candidates_data:
                    parts = candidates_data[0].get("content", {}).get("parts") or []
                    if parts:
                        text = parts[0].get("text", "").strip()
                        if text:
                            return text
        except urllib.error.HTTPError as http_err:
            last_error_code = http_err.code
            err_body = ""
            try:
                err_body = http_err.read().decode("utf-8")
            except Exception:
                pass
            last_error_msg = f"HTTP {http_err.code}: {http_err.reason}"

            if http_err.code == 404:
                print(f"[Gemini REST] Model '{target_model}' returned 404 NOT_FOUND. Trying next model...")
                continue
            if http_err.code == 429:
                print(f"[Gemini REST] Model '{target_model}' returned 429 QUOTA_EXCEEDED. Trying next model...")
                continue
            if http_err.code in (400, 401, 403):
                if "API_KEY_INVALID" in err_body or "API key not valid" in err_body:
                    return (
                        "Gemini API Error (401/403 Invalid API Key): The server rejected the API key provided in backend/.env.\n\n"
                        "Please get a valid free key at https://aistudio.google.com/app/apikey (starts with 'AIzaSy...'), "
                        "update backend/.env, and restart the backend server."
                    )
                return f"Gemini API Error ({http_err.code} {http_err.reason}): {err_body}"
            break
        except Exception as e:
            last_error_msg = str(e)
            break

    # Accurate diagnostics based on HTTP error codes
    if last_error_code == 404:
        models_preview = ", ".join(supported_models[:5]) if supported_models else "None found"
        return (
            f"Study Mode Error (404 Model Not Found): None of the attempted models ({', '.join(attempted_models)}) "
            f"were found for this API key. Available models for your key: [{models_preview}]. "
            "Please update GEMINI_MODEL in backend/.env and restart the backend."
        )
    if last_error_code == 429:
        return (
            "Study Mode Notice (429 Rate Limit Exceeded): You have temporarily reached the Gemini API request quota. "
            "Please wait a few moments and try your query again."
        )
    if last_error_code in (401, 403):
        return (
            "Study Mode Error (403 Forbidden): Access to Gemini API was denied. "
            "Please verify your GEMINI_API_KEY in backend/.env."
        )

    return f"Study Mode Error: Unable to complete request with models ({', '.join(attempted_models)}). Details: {last_error_msg}"


# ============================================================
# Finance command parser
# ============================================================
def parse_finance(text):
    t = text.lower().strip()
    tokens = t.split()
    if tokens and tokens[0] in ("add", "create") and len(tokens) >= 3:
        ttype = "Expense" if tokens[1] == "expense" else "Income"
        try:
            amt = float(tokens[2])
        except Exception:
            return {"error": "Invalid amount provided."}
        if ttype == "Expense":
            amt = -abs(amt)
        category = tokens[3] if len(tokens) > 3 else "Other"
        desc = " ".join(tokens[4:]) if len(tokens) > 4 else f"{ttype} {category}"
        tx = {
            "date": datetime.date.today().isoformat(),
            "description": desc,
            "category": category,
            "amount": amt,
            "type": ttype,
        }
        return {"action": "create", "data": tx}
    if tokens and tokens[0] in ("delete", "remove") and len(tokens) >= 3:
        ttype = "Expense" if tokens[1] == "expense" else "Income"
        try:
            amt = float(tokens[2])
        except Exception:
            return {"error": "Invalid amount for delete."}
        category = tokens[3] if len(tokens) > 3 else "Other"
        return {"action": "delete", "data": {"type": ttype, "amount": amt, "category": category}}
    if "balance" in t or "net worth" in t:
        return {"action": "balance"}
    if "expenses" in t or "total expenses" in t or "spend" in t:
        return {"action": "expenses"}
    return {"error": "unknown"}


# ============================================================
# Assistant command parser
# ============================================================
CONTACTS = {"me": "+91939999999", "gu": "+918584454454"}


def parse_assistant_command(text):
    t = (text or "").strip().lower()
    if "open youtube" in t or t.startswith("youtube"):
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
        return {"action": "open_url", "url": "https://www.linkedin.com", "reply": "Opening LinkedIn"}
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
        return {"reply": "WhatsApp feature disabled (pywhatkit not installed)."}
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
                    except Exception:
                        pass
            threading.Thread(target=press_enter_after_delay, daemon=True).start()
            return {"reply": f"WhatsApp scheduled for {hour}:{minute:02d} to {contact_key}."}
    except Exception as e:
        return {"reply": f"pywhatkit error: {e}"}


# ============================================================
# Health check & Config
# ============================================================
@app.get("/api/health")
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        "gemini_configured": bool(os.environ.get("GEMINI_API_KEY"))
    })


@app.get("/config.js")
def config_js():
    return (
        f"window.SUPABASE_URL = {SUPABASE_URL!r};\n"
        f"window.SUPABASE_ANON_KEY = {SUPABASE_ANON_KEY!r};\n",
        200,
        {"Content-Type": "application/javascript"},
    )


# ============================================================
# Transactions CRUD (Postgres via Supabase, scoped to user)
# ============================================================
@app.get("/api/transactions")
@require_auth
def get_transactions():
    resp = (
        g.db.table("transactions")
        .select("*")
        .order("date", desc=True)
        .execute()
    )
    return jsonify({"status": True, "data": resp.data})


@app.post("/api/transactions")
@require_auth
def post_transaction():
    tx = request.json or {}
    if not tx.get("description"):
        return jsonify({"status": False, "message": "Description required"}), 400
    if tx.get("amount") is None:
        return jsonify({"status": False, "message": "Amount required"}), 400

    tx["user_id"] = g.user.id
    try:
        resp = g.db.table("transactions").insert(tx).execute()
        return jsonify({"status": True, "data": resp.data[0]})
    except Exception as e:
        return jsonify({"status": False, "message": str(e)}), 500


@app.delete("/api/transactions/<int:tx_id>")
@require_auth
def del_transaction(tx_id):
    resp = g.db.table("transactions").delete().eq("id", tx_id).execute()
    if not resp.data:
        return jsonify({"status": False, "message": "Transaction not found"}), 404
    return jsonify({"status": True, "message": "Transaction deleted"})


@app.put("/api/transactions/<int:tx_id>")
@require_auth
def update_transaction(tx_id):
    updated = request.json or {}
    updated.pop("user_id", None)
    resp = g.db.table("transactions").update(updated).eq("id", tx_id).execute()
    if not resp.data:
        return jsonify({"status": False, "message": "Transaction not found"}), 404
    return jsonify({"status": True, "message": "Transaction updated", "data": resp.data[0]})


# ============================================================
# Budgets (Postgres via Supabase, scoped to logged-in user)
# ============================================================
def normalize_category(category):
    if not category:
        return "Other"
    c = category.lower()
    if "food" in c or "grocer" in c or c == "drink":
        return "Food & Dining"
    if "entertain" in c:
        return "Entertainment"
    if "transport" in c:
        return "Transportation"
    if "hous" in c:
        return "Housing"
    if "util" in c:
        return "Utilities"
    return category


@app.get("/api/budgets")
@require_auth
def get_budget_structure():
    tx_resp = g.db.table("transactions").select("category, amount, type").execute()
    transactions = tx_resp.data or []

    budgets_resp = g.db.table("budgets").select("*").execute()
    budgets = budgets_resp.data or []

    spent = {}
    for tx in transactions:
        if tx.get("type") == "Expense":
            cat = normalize_category(tx.get("category"))
            spent[cat] = spent.get(cat, 0) + abs(tx.get("amount", 0))

    existing = {b["category"] for b in budgets}
    for cat in spent.keys():
        if cat not in existing:
            new_budget = {"category": cat, "limit": 500, "user_id": g.user.id}
            insert_resp = g.db.table("budgets").insert(new_budget).execute()
            if insert_resp.data:
                budgets.append(insert_resp.data[0])

    result = []
    for b in budgets:
        limit = b.get("limit", 0)
        s = spent.get(b["category"], 0)
        result.append({
            "id": b.get("id"),
            "category": b["category"],
            "limit": limit,
            "spent": s,
            "percentage": round((s / limit) * 100, 2) if limit else 0,
        })

    return jsonify({"status": True, "data": result})


@app.post("/api/budgets/update")
@require_auth
def update_budget_limits():
    body = request.get_json()
    items = body if isinstance(body, list) else [body]

    results = []
    for item in items:
        category = (item or {}).get("category")
        limit = (item or {}).get("limit")
        if not category or limit is None or limit < 0:
            continue
        existing = g.db.table("budgets").select("id").eq("category", category).execute()
        if existing.data:
            resp = g.db.table("budgets").update({"limit": limit}).eq("category", category).execute()
        else:
            resp = g.db.table("budgets").insert(
                {"category": category, "limit": limit, "user_id": g.user.id}
            ).execute()
        if resp.data:
            results.extend(resp.data)

    return jsonify({"status": True, "data": results})


@app.delete("/api/budgets/<string:cat_name>")
@require_auth
def delete_budget(cat_name):
    resp = g.db.table("budgets").delete().eq("category", cat_name).execute()
    if not resp.data:
        return jsonify({"status": False, "message": "Category not found"}), 404
    return jsonify({"status": True, "message": "Budget category deleted"})


# ============================================================
# Goals (Postgres via Supabase, scoped to logged-in user)
# ============================================================
@app.get("/api/goals")
@require_auth
def get_goals():
    resp = (
        g.db.table("goals")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return jsonify({"status": True, "data": resp.data})


@app.post("/api/goals")
@require_auth
def post_goal():
    new = request.json or {}
    new["user_id"] = g.user.id
    new.setdefault("saved", 0)
    resp = g.db.table("goals").insert(new).execute()
    return jsonify({"status": True, "data": resp.data[0] if resp.data else new})


@app.patch("/api/goals/<int:goal_id>/add")
@require_auth
def add_to_goal(goal_id):
    body = request.json or {}
    amount = float(body.get("amount", 0))

    goal_resp = (
        g.db.table("goals")
        .select("*")
        .eq("id", goal_id)
        .single()
        .execute()
    )

    if goal_resp.data is None:
        return jsonify({"status": False, "message": "Goal not found"}), 404

    goal = goal_resp.data
    saved = float(goal.get("saved") or 0)
    target = float(goal.get("target") or 0)
    new_saved = min(saved + amount, target)

    update_resp = (
        g.db.table("goals")
        .update({"saved": new_saved})
        .eq("id", goal_id)
        .execute()
    )

    return jsonify({"status": True, "data": update_resp.data[0]})


@app.delete("/api/goals/<int:goal_id>")
@require_auth
def delete_goal(goal_id):
    resp = g.db.table("goals").delete().eq("id", goal_id).execute()
    if not resp.data:
        return jsonify({"status": False, "message": "Goal not found"}), 404
    return jsonify({"status": True, "message": "Goal deleted"})


# ============================================================
# Assistant endpoint (finance / assistant / study modes)
# ============================================================
@app.post("/assistant")
@require_auth
def assistant_endpoint():
    body = request.json or {}
    text = (body.get("text") or "").strip()
    mode = (body.get("mode") or "").lower()
    if not text:
        return jsonify({"reply": "Please provide a query."}), 400

    if mode == "finance":
        p = parse_finance(text)
        if p.get("error") == "unknown":
            return jsonify({"reply": "Finance command not recognized. Example: 'add expense 50 lunch' or 'show balance'"}), 400
        if p.get("error"):
            return jsonify({"reply": f"Finance Parse Error: {p['error']}"}), 400

        action = p.get("action")
        if action == "create":
            tx = p["data"]
            tx["user_id"] = g.user.id
            g.db.table("transactions").insert(tx).execute()
            speak(f"{tx['type']} of {abs(tx['amount'])} added.")
            return jsonify({"reply": f"Added {tx['type']}: {tx['description']} (₹{abs(tx['amount'])})"})

        if action == "balance":
            resp = g.db.table("transactions").select("amount").execute()
            bal = sum(t["amount"] for t in (resp.data or []))
            reply_text = f"Your current balance is ₹{bal:.2f}"
            speak(reply_text)
            return jsonify({"reply": reply_text})

        if action == "expenses":
            resp = g.db.table("transactions").select("amount").execute()
            exp = sum(t["amount"] for t in (resp.data or []) if t.get("amount", 0) < 0)
            reply_text = f"Total expenses: ₹{abs(exp):.2f}"
            speak(reply_text)
            return jsonify({"reply": reply_text})

        if action == "delete":
            target = p["data"]
            resp = g.db.table("transactions").select("*") \
                .eq("type", target["type"]).eq("amount", target["amount"]).limit(1).execute()
            if not resp.data:
                return jsonify({"reply": "Transaction not found."})
            deleted = resp.data[0]
            g.db.table("transactions").delete().eq("id", deleted["id"]).execute()
            speak(f"{deleted['type']} of {abs(deleted['amount'])} deleted.")
            return jsonify({"reply": f"Deleted {deleted['type']} ₹{deleted['amount']} ({deleted['description']})"})

    if mode == "assistant":
        cmd = parse_assistant_command(text)
        action = cmd.get("action")
        if action == "open_url":
            url = cmd["url"]
            try:
                if webbrowser:
                    webbrowser.open(url)
            except Exception:
                pass
            return jsonify({"reply": cmd.get("reply", f"Opened {url}."), "url": url})
        if action == "play_sound":
            if winsound:
                sound_file = cmd.get("file")
                try:
                    winsound.PlaySound(sound_file, winsound.SND_FILENAME | winsound.SND_ASYNC)
                    return jsonify({"reply": f"Playing sound (if '{sound_file}' exists)."})
                except Exception as e:
                    return jsonify({"reply": f"Failed to play sound: {e}"}), 500
            return jsonify({"reply": "Sound playback is not supported on this platform."})
        if action == "ask_for_message":
            return jsonify({"reply": f"Please provide the message to send to {cmd.get('contact')}."})
        if action == "whatsapp":
            result = send_whatsapp_message(cmd.get("contact"), cmd.get("message"))
            return jsonify(result)
        return jsonify({"reply": "Assistant command not recognized. Example: 'open youtube search python' or 'open google'"}), 400

    if mode == "study":
        answer = ask_gemini_study(text)
        # Note: Do not invoke server-side pyttsx3 speak() so user audio is not forced on host OS.
        # Audio playback is cleanly controlled on the client side via the browser Speech Synthesis API.
        return jsonify({"reply": answer, "mode": "study"})

    return jsonify({"reply": "Please select a mode: Finance, Assistant, or Study."}), 400


@app.post("/assistant/stop-speech")
def stop_speech_endpoint():
    """Immediately stops server-side TTS playback if active."""
    if tts_engine:
        try:
            tts_engine.stop()
        except Exception:
            pass
    return jsonify({"status": True, "message": "Speech stopped"})


@app.post("/assistant/voice")
@require_auth
def assistant_voice_endpoint():
    return assistant_endpoint()


if __name__ == "__main__":
    port = int(os.environ.get("PORT") or os.environ.get("APP_PORT") or 8000)
    host = os.environ.get("APP_HOST") or "0.0.0.0"
    debug = os.environ.get("APP_DEBUG", "true").lower() == "true"
    print(f"Starting Assistant Server on {host}:{port}...")
    app.run(host=host, port=port, debug=debug)
