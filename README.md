# FinanceFlow - Full-Stack AI FinTech Application

A full-stack financial management dashboard with intelligent budgeting, transaction tracking, goals management, and an AI-powered Smart Buddy Assistant featuring Study Mode powered by Google Gemini AI.

---

## 📁 Repository Structure

```
FinTech/
├── backend/                   # Python Flask Backend
│   ├── app.py                 # Core API & Assistant Server
│   ├── requirements.txt       # Python dependencies
│   ├── schema.sql             # Supabase PostgreSQL schema & setup script
│   ├── .env                   # Local backend secrets (git-ignored)
│   └── .env.example           # Example backend configuration
│
├── frontend/                  # React SPA (Tailwind CSS, Lucide, Chart.js)
│   ├── public/                # HTML, icons & manifest
│   ├── src/                   # React components & state management
│   ├── package.json           # Frontend dependencies & scripts
│   ├── vercel.json            # SPA routing configuration for Vercel
│   ├── .env                   # Local frontend secrets (git-ignored)
│   └── .env.example           # Example frontend configuration
│
├── package.json               # Root monorepo configuration for Vercel builds
├── vercel.json                # Root Vercel build & SPA rewrite configuration
└── README.md                  # Project documentation & deployment guide
```

---

## 🚀 How to Deploy on Vercel

### Step 1: Push your code to GitHub
Make sure all your latest files are committed and pushed to your GitHub repository.

### Step 2: Import into Vercel
1. Log in to [Vercel](https://vercel.com/) and click **"Add New..." > "Project"**.
2. Select your `FinTech` GitHub repository and click **Import**.
3. **Framework Preset**: Vercel will automatically detect `Create React App`.
4. **Build & Output Settings**: Pre-configured via `vercel.json` (Build command: `cd frontend && npm install && npm run build`, Output directory: `frontend/build`).

### Step 3: Add Environment Variables in Vercel
In the Vercel project configuration, add these under **Environment Variables**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `REACT_APP_SUPABASE_URL` | Your Supabase project URL | `https://xyz.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase Anon Public Key | `eyJhbGci...` |
| `REACT_APP_API_URL` | URL of your deployed Python backend | `https://your-backend.onrender.com` |

*(If you run the backend on Render/Railway, set `REACT_APP_API_URL` to its URL. In local development, it automatically defaults to `http://127.0.0.1:8000`)*.

Click **Deploy**! Vercel will build the frontend and deploy it to a live `.vercel.app` domain.

---

## 📚 Why Study Mode Was Not Working & How It Is Fixed

### The Causes:
1. **Invalid API Key Format**:
   - The key in `.env` began with `AQ.Ab8...`, which is not a valid Google AI Studio Gemini API key.
   - Official Gemini API keys **always start with `AIzaSy...`** (39 characters).
2. **Missing SDK / Version Incompatibility**:
   - The codebase previously expected `google-genai`. If a user had `google-generativeai` installed or lacked the new SDK, Study Mode would completely fail.
3. **Frontend Listening State Bug**:
   - In `AssistantPage.js`, selecting "Study Mode" from the dropdown triggered `setListening(true)`, switching the avatar to "Listening" without activating speech recognition.
4. **Server vs. Browser Speech**:
   - Text-to-speech previously relied on `pyttsx3` on the server machine, which cannot play audio in the cloud (e.g. on Vercel/Render).

### The Fixes Implemented:
1. **Multi-Tier Gemini AI Engine**:
   - `backend/app.py` now tries the modern `google.genai` SDK first, then legacy `google.generativeai`, and finally a universal direct REST API call (`https://generativelanguage.googleapis.com/...`) requiring zero extra libraries!
   - Automatic fallback to `gemini-1.5-flash` if `gemini-2.0-flash` is not enabled for your key.
2. **Clear Diagnostics**:
   - If your API key is missing or does not start with `AIzaSy...`, the assistant displays a clear, actionable guide directly in the chat with a link to get a free key.
3. **Browser Native Speech Synthesis**:
   - The assistant now uses standard browser `window.speechSynthesis` so voice answers work on any device and in any cloud deployment.
4. **Clean UI State**:
   - Fixed dropdown mode selection to reset listening state properly.

### 🔑 How to activate Study Mode with your free Gemini key:
1. Go to [Google AI Studio (aistudio.google.com/app/apikey)](https://aistudio.google.com/app/apikey).
2. Click **Create API Key** (Free, no credit card required).
3. Copy the key (starts with `AIzaSy...`).
4. Paste it into `backend/.env`:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualKeyHere
   GEMINI_MODEL=gemini-2.0-flash
   ```
5. Restart your backend server (`python app.py`). Study Mode will work instantly!

---

## 💻 Running Locally

### 1. Backend Setup (Flask + Supabase + Gemini)
```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python app.py
```
Backend runs at `http://127.0.0.1:8000`.

### 2. Frontend Setup (React)
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```
Frontend runs at `http://localhost:3000`.