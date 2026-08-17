import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User, Mail, Calendar, Shield, LogOut, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="space-y-6 max-w-2xl" data-testid="profile-page">
      <header>
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Module 04 — Identity</div>
        <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 leading-none">
          Profile
        </h1>
        <p className="mt-3 text-slate-600 text-sm">Your account details.</p>
      </header>

      <section className="border border-slate-200 bg-white divide-y divide-slate-200">
        <Row icon={User} label="Name" value={user?.name || "—"} testid="profile-name" />
        <Row icon={Mail} label="Email" value={user?.email || "—"} testid="profile-email" mono />
        <Row
          icon={Calendar}
          label="Member since"
          value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
          testid="profile-joined"
        />
        <Row
          icon={Shield}
          label="Security"
          value="Password hashed with bcrypt · JWT session"
          testid="profile-security"
        />
      </section>

      <div className="border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Source Code</div>
            <div className="text-sm text-slate-700 mt-1">Download the complete project (FastAPI backend + React frontend) as a ZIP archive.</div>
          </div>
          <a
            href="/aadhaar-ocr-source.zip"
            download
            data-testid="download-source-button"
            className="inline-flex items-center gap-2 bg-[#138808] hover:bg-[#0F6C06] text-white text-sm font-medium rounded-sm px-4 py-2 transition-colors"
          >
            <Download className="h-4 w-4" /> Download Source (.zip)
          </a>
        </div>
      </div>

      <div className="border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Session</div>
            <div className="text-sm text-slate-700 mt-1">End your current signed-in session on this device.</div>
          </div>
          <button
            onClick={onLogout}
            data-testid="profile-logout-button"
            className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-red-300 hover:text-red-600 text-slate-700 text-sm font-medium rounded-sm px-4 py-2 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, testid, mono = false }) {
  return (
    <div className="grid grid-cols-3 items-center">
      <div className="col-span-1 px-4 py-4 border-r border-slate-200 bg-[#F8FAFC] flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      </div>
      <div className={["col-span-2 px-4 py-4 text-sm text-slate-900", mono ? "mono" : ""].join(" ")} data-testid={testid}>
        {value}
      </div>
    </div>
  );
}
