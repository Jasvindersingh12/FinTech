import { useState } from "react";
import { supabase } from "../supabase";

export default function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (isSignIn) {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.name,
            phone: form.phone,
          },
        },
      });
      if (error) return alert(error.message);
      alert("Check your email for verification!");
    }
  }

  return (
   <div className="min-h-screen flex items-center justify-center" style={{ 
  background: "linear-gradient(135deg, #e4c8c9ff 0%, #fad0c4 50%, #fad0c4 100%)"
}}>
  <div className="bg-white p-8 rounded-xl w-full max-w-md shadow-lg">
    <h1 className="text-3xl font-bold mb-4 text-center">
          {isSignIn ? "Sign In" : "Sign Up"}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isSignIn && (
            <>
              <input
                name="name"
                type="text"
                onChange={handleChange}
                value={form.name}
                placeholder="Full Name"
                className="p-3 border rounded-lg"
                required
              />
              <input
                name="phone"
                type="tel"
                onChange={handleChange}
                value={form.phone}
                placeholder="Phone Number"
                className="p-3 border rounded-lg"
                required
              />
            </>
          )}

          <input
            name="email"
            type="email"
            onChange={handleChange}
            value={form.email}
            placeholder="Email"
            className="p-3 border rounded-lg"
            required
          />

          <input
            name="password"
            type="password"
            onChange={handleChange}
            value={form.password}
            placeholder="Password"
            className="p-3 border rounded-lg"
            required
          />

          <button className="bg-purple-600 text-white p-3 rounded-lg">
            {isSignIn ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <p className="text-center mt-4">
          <button
            onClick={() => setIsSignIn(!isSignIn)}
            className="text-purple-600 font-semibold"
          >
            {isSignIn
              ? "Need an account? Sign Up"
              : "Already have an account? Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}
  