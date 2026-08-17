import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, UserPlus, Mail, Lock, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, Field } from "@/pages/Login";

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const r = await register(name.trim(), email.trim(), password);
    setSubmitting(false);
    if (r.ok) {
      toast.success("Account created");
      navigate("/", { replace: true });
    } else {
      setError(r.error);
      toast.error("Signup failed", { description: r.error });
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Free. No card required. Takes 20 seconds.">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="signup-form">
        <Field label="Full Name" icon={User} value={name} onChange={setName} placeholder="Jane Doe" testid="signup-name" />
        <Field label="Email" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" testid="signup-email" />
        <Field label="Password" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="At least 6 chars with a digit" testid="signup-password" />

        {error && (
          <div className="text-xs text-red-600 border border-red-200 bg-red-50 px-3 py-2" data-testid="signup-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          data-testid="signup-submit"
          className="w-full bg-[#FF9933] hover:bg-[#E88422] disabled:opacity-50 text-white font-medium rounded-sm px-6 py-3 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-200 text-sm text-slate-600 text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-[#FF9933] font-medium hover:underline" data-testid="login-link">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
