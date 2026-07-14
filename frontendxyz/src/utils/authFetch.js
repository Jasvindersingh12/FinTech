const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

export async function authFetch(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }), // Only add header if token exists
    ...options.headers
  };
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const res = await fetch(fullUrl, { ...options, headers });
  
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }
    throw new Error(`Request failed: ${res.status}`);
  }
  
  return res.json();
}