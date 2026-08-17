import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("tushar@aadhaarscan.app");
  const [password, setPassword] = useState("tushar@1234");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const r = await login(email.trim(), password);
    setSubmitting(false);
    if (r.ok) {
      toast.success("Welcome back");
      const to = location.state?.from?.pathname || "/";
      navigate(to, { replace: true });
    } else {
      setError(r.error);
      toast.error("Login failed", { description: r.error });
    }
  };

  return (
    <AuthShell title="Sign in to your account" subtitle="Scan Aadhaar documents and track your history.">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
        <Field
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          testid="login-email"
        />
        <Field
          label="Password"
          icon={Lock}
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          testid="login-password"
        />
        {error && (
          <div className="text-xs text-red-600 border border-red-200 bg-red-50 px-3 py-2" data-testid="login-error">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          data-testid="login-submit"
          className="w-full bg-[#FF9933] hover:bg-[#E88422] disabled:opacity-50 text-white font-medium rounded-sm px-6 py-3 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-200 text-sm text-slate-600 text-center">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="text-[#FF9933] font-medium hover:underline" data-testid="signup-link">
          Create one
        </Link>
      </div>

      <div className="mt-4 text-[11px] mono uppercase tracking-[0.2em] text-slate-400 text-center">
        Demo: tushar@aadhaarscan.app · tushar@1234
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-[#F8FAFC]">
      <div className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden border-r border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 border-2 border-[#FF9933] flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-[#FF9933]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Aadhaar</div>
            <div className="text-lg font-semibold tracking-tight text-slate-900">Scan Console</div>
          </div>
        </div>

        <div className="relative">
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-3">Module 01</div>
          <h1 className="text-4xl font-semibold tracking-tight leading-none text-slate-900">
            Extract Aadhaar fields<br />
            <span className="text-[#138808]">in seconds.</span>
          </h1>
          <p className="mt-5 text-slate-600 max-w-md">
            Upload a photo, PDF, or capture with your camera. Everything runs in memory — we never
            store the image.
          </p>
        </div>

        <div className="border-t border-slate-200 pt-5 text-xs text-slate-500 space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#FF9933]" /> Masked Aadhaar output · XXXX XXXX 1234
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#138808]" /> JWT secured dashboard
          </div>
          <div className="text-slate-400 mono text-[10px] uppercase tracking-[0.25em] pt-2">Not affiliated with UIDAI</div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 sm:px-10 py-12 md:py-0">
        <div className="w-full max-w-sm mx-auto fade-up">
          <div className="mb-6 md:hidden flex items-center gap-3">
            <div className="h-9 w-9 border-2 border-[#FF9933] flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#FF9933]" />
            </div>
            <div className="font-semibold">Aadhaar Scan</div>
          </div>
          <div className="mb-6">
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-2">Access</div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({ label, icon: Icon, type = "text", value, onChange, placeholder, testid }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5 block">{label}</span>
      <div className="flex items-center border border-slate-300 bg-white focus-within:border-[#FF9933] focus-within:ring-2 focus-within:ring-[#FF9933]/20 transition-colors">
        {Icon && <Icon className="h-4 w-4 text-slate-400 ml-3" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={testid}
          required
          className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
        />
      </div>
    </label>
  );
}
