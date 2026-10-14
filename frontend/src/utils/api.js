import { supabase } from "../supabase";

// In production, use REACT_APP_API_URL or default to relative path (for Vercel rewrites).
// In development, default to local Flask server http://127.0.0.1:8000.
const API_BASE =
  process.env.REACT_APP_API_URL !== undefined
    ? process.env.REACT_APP_API_URL
    : process.env.NODE_ENV === "production"
    ? ""
    : "http://127.0.0.1:8000";

// Automatically attaches the logged-in user's Supabase token.
export async function authFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  // If path is already a full URL, use it directly; otherwise prefix with API_BASE
  const url = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${API_BASE}${path}`;

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}