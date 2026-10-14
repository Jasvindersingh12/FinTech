import { useState } from "react";
import { supabase } from "../supabase";

export default function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errorMsg) setErrorMsg("");
    if (successMsg) setSuccessMsg("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    const email = (form.email || "").trim();
    const password = form.password;

    try {
      if (isSignIn) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("Sign in error:", error);
          const msg = error.message.toLowerCase();
          if (msg.includes("email not confirmed")) {
            setErrorMsg(
              "Your email is not confirmed yet. Run the SQL confirmation query in Supabase SQL editor or confirm via email."
            );
          } else if (msg.includes("invalid login credentials")) {
            setErrorMsg(
              "Invalid email or password. If you haven't created an account yet, switch to 'Sign Up'."
            );
          } else {
            setErrorMsg(error.message);
          }
          return;
        }

        // Successfully signed in; App1's onAuthStateChange listener handles navigation
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: form.name.trim(),
              phone: form.phone.trim(),
            },
          },
        });

        if (error) {
          console.error("Sign up error:", error);
          setErrorMsg(error.message);
          return;
        }

        if (data?.session) {
          setSuccessMsg("Account created! Logging in...");
        } else {
          setSuccessMsg(
            "Account created successfully! If email confirmation is required, confirm it in your inbox or run the confirmation query in Supabase."
          );
          setIsSignIn(true);
        }
      }
    } catch (err) {
      console.error("Unexpected auth error:", err);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)",
      }}
    >
      <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl w-full max-w-md shadow-2xl border border-white/20">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-lg mb-3">
            <span className="text-2xl font-bold">₹</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {isSignIn ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSignIn
              ? "Sign in to access your FinTech dashboard"
              : "Start managing your finances effortlessly"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignIn(true);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              isSignIn
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignIn(false);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              !isSignIn
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start space-x-2">
            <svg
              className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Success notification banner */}
        {successMsg && (
          <div className="mb-4 p-3.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl flex items-start space-x-2">
            <svg
              className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">{successMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isSignIn && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                  Full Name
                </label>
                <input
                  name="name"
                  type="text"
                  onChange={handleChange}
                  value={form.name}
                  placeholder="e.g. Jazvinder Singh"
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                  Phone Number
                </label>
                <input
                  name="phone"
                  type="tel"
                  onChange={handleChange}
                  value={form.phone}
                  placeholder="e.g. 9876543210"
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Email Address
            </label>
            <input
              name="email"
              type="email"
              onChange={handleChange}
              value={form.email}
              placeholder="e.g. user@example.com"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                onChange={handleChange}
                value={form.password}
                placeholder="Enter your password"
                className="w-full p-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium px-1 py-1"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition duration-200 mt-2 flex items-center justify-center space-x-2 ${
              loading ? "opacity-75 cursor-not-allowed" : ""
            }`}
          >
            {loading && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            <span>
              {loading
                ? isSignIn
                  ? "Signing In..."
                  : "Creating Account..."
                : isSignIn
                ? "Sign In"
                : "Create Account"}
            </span>
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-gray-500">
          {isSignIn ? "Don't have an account? " : "Already registered? "}
          <button
            type="button"
            onClick={() => {
              setIsSignIn(!isSignIn);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className="text-purple-600 font-semibold hover:underline"
          >
            {isSignIn ? "Sign Up" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}