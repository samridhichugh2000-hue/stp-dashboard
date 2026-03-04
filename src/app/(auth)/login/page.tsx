"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Shield, User, Zap, ArrowLeft } from "lucide-react";

type RoleChoice = "admin" | "user" | null;

export default function LoginPage() {
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [roleChoice, setRoleChoice] = useState<RoleChoice>(null);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard/overview");
  }, [isAuthenticated, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setError("");
    setLoading(true);
    try {
      await signIn("password", { email: email.trim(), password, flow: "signIn" });
      // Redirect is handled by DashboardShell based on role
      router.replace("/dashboard/overview");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #f8fafc 50%, #f5f3ff 100%)" }}>

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg mb-4">
            <Zap size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">STP Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Sales Training Portal</p>
        </div>

        {/* ── Step 1: Role selection ── */}
        {!roleChoice && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700 text-center mb-2">Sign in as</p>

            <button
              onClick={() => setRoleChoice("admin")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-transparent bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-all group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
                <Shield size={22} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">Admin Login</p>
                <p className="text-xs text-gray-500 mt-0.5">Full dashboard access — all sections</p>
              </div>
            </button>

            <button
              onClick={() => setRoleChoice("user")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-transparent bg-sky-50 hover:border-sky-400 hover:bg-sky-100 transition-all group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-md flex-shrink-0">
                <User size={22} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 group-hover:text-sky-700 transition-colors">User Login</p>
                <p className="text-xs text-gray-500 mt-0.5">Access to FAQ &amp; Documents only</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Step 2: Credentials form ── */}
        {roleChoice && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            {/* Header with back button */}
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => { setRoleChoice(null); setError(""); setEmail(""); setPassword(""); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  roleChoice === "admin"
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600"
                    : "bg-gradient-to-br from-sky-400 to-cyan-500"
                }`}>
                  {roleChoice === "admin" ? <Shield size={14} className="text-white" /> : <User size={14} className="text-white" />}
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {roleChoice === "admin" ? "Admin Login" : "User Login"}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@koenig-solutions.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Password</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className={`w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 ${
                  roleChoice === "admin"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                    : "bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600"
                }`}
              >
                {loading && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-400">
              Contact your administrator for account access
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
