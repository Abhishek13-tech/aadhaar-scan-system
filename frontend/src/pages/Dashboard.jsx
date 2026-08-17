import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Files,
  ArrowUpRight,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [s, h] = await Promise.all([
          api.get("/stats"),
          api.get("/history", { params: { limit: 6 } }),
        ]);
        if (!live) return;
        setStats(s.data);
        setRecent(h.data);
      } catch (e) {
        toast.error("Couldn't load dashboard", { description: apiErrorMessage(e) });
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const successRate =
    stats && stats.total_uploads
      ? Math.round((stats.successful / stats.total_uploads) * 100)
      : 0;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Module 00 — Overview</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 leading-none">
            Hello, {user?.name?.split(" ")[0] || "there"}.
          </h1>
          <p className="mt-3 text-slate-600 text-sm md:text-base max-w-xl">
            Your Aadhaar scanning activity at a glance. Upload a new document or review recent extractions.
          </p>
        </div>
        <Link
          to="/upload"
          data-testid="dashboard-new-scan-cta"
          className="inline-flex items-center gap-2 bg-[#FF9933] hover:bg-[#E88422] text-white text-sm font-medium rounded-sm px-5 py-3 transition-colors"
        >
          <ScanLine className="h-4 w-4" /> New Scan
        </Link>
      </header>

      {/* Stats grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 border border-slate-200 bg-white">
        <StatCard
          label="Total Uploads"
          value={loading ? "—" : stats?.total_uploads ?? 0}
          icon={Files}
          accent="text-slate-900"
          testid="stat-total"
        />
        <StatCard
          label="Successful"
          value={loading ? "—" : stats?.successful ?? 0}
          icon={CheckCircle2}
          accent="text-[#138808]"
          testid="stat-success"
          border
        />
        <StatCard
          label="Failed"
          value={loading ? "—" : stats?.failed ?? 0}
          icon={AlertCircle}
          accent="text-red-600"
          testid="stat-failed"
        />
      </section>

      {/* Success ratio bar */}
      <section className="border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Success Rate</div>
          <div className="text-sm font-medium text-slate-900" data-testid="success-rate">
            {loading ? "—" : `${successRate}%`}
          </div>
        </div>
        <div className="h-2 bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-[#138808] transition-all duration-500"
            style={{ width: `${loading ? 0 : successRate}%` }}
          />
        </div>
        <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Last scan:{" "}
          <span className="text-slate-700">
            {stats?.last_upload_at ? formatRelative(stats.last_upload_at) : "never"}
          </span>
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Module 02</div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Recent activity</h2>
          </div>
          <Link to="/history" className="text-xs text-[#FF9933] font-medium flex items-center gap-1 hover:underline" data-testid="view-all-history">
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : recent.length === 0 ? (
            <div className="p-8 text-center">
              <ScanLine className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <div className="text-sm text-slate-600 mb-4">No scans yet. Upload your first Aadhaar card to see extracted data.</div>
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-sm px-4 py-2 transition-colors"
              >
                <ScanLine className="h-4 w-4" /> Start a scan
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="recent-activity-table">
              <thead className="bg-[#F8FAFC]">
                <tr className="text-left">
                  <Th>File</Th>
                  <Th>Name</Th>
                  <Th>Aadhaar</Th>
                  <Th>Status</Th>
                  <Th className="text-right">When</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`recent-row-${r.id}`}>
                    <Td className="max-w-[180px] truncate">{r.filename || "—"}</Td>
                    <Td>{r.name || "—"}</Td>
                    <Td className="mono">{r.aadhaar_masked || "—"}</Td>
                    <Td>
                      <StatusBadge success={r.success} />
                    </Td>
                    <Td className="text-right text-slate-500 mono text-xs">{formatRelative(r.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent, border, testid }) {
  return (
    <div
      className={[
        "p-5 flex items-center justify-between",
        border ? "md:border-l md:border-r border-slate-200" : "",
      ].join(" ")}
      data-testid={testid}
    >
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</div>
        <div className={`mt-2 text-3xl font-semibold tracking-tight ${accent}`}>{value}</div>
      </div>
      <Icon className={`h-8 w-8 ${accent} opacity-80`} strokeWidth={1.5} />
    </div>
  );
}

function StatusBadge({ success }) {
  return success ? (
    <span className="inline-flex items-center gap-1 text-[#138808] bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium rounded-sm">
      <CheckCircle2 className="h-3 w-3" /> Success
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium rounded-sm">
      <AlertCircle className="h-3 w-3" /> Failed
    </span>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`mono text-[10px] uppercase tracking-[0.2em] text-slate-500 px-4 py-2.5 font-normal ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-2.5 text-slate-700 ${className}`}>{children}</td>;
}

function formatRelative(iso) {
  if (!iso) return "—";
  const then = new Date(iso);
  const diff = (Date.now() - then.getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return then.toLocaleDateString();
}
