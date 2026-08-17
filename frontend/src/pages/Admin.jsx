import React, { useEffect, useMemo, useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Shield,
  ShieldCheck,
  Search,
  UserCheck,
  UserX,
  ScrollText,
  LayoutGrid,
  TrendingUp,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "users", label: "Users", icon: Users },
  { id: "audit", label: "Audit Log", icon: ScrollText },
];

export default function AdminPage() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-6" data-testid="admin-page">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Admin · Console</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 leading-none">
            Operator panel
          </h1>
          <p className="mt-3 text-slate-600 text-sm max-w-xl">
            Manage users, monitor system-wide activity, and review the audit trail.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            data-testid={`admin-tab-${id}`}
            className={[
              "px-4 py-2.5 text-sm font-medium tracking-tight flex items-center gap-2 border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === id
                ? "border-[#FF9933] text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

/* ----------------------------- Overview ----------------------------- */
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data } = await api.get("/admin/stats");
        if (live) setStats(data);
      } catch (e) {
        toast.error("Couldn't load stats", { description: apiErrorMessage(e) });
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  if (loading || !stats) {
    return (
      <div className="border border-slate-200 bg-white p-12 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-up">
      {/* KPI grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 bg-white">
        <Kpi label="Total Users"   value={stats.total_users}    icon={Users}        accent="text-slate-900" testid="admin-kpi-users" />
        <Kpi label="Active Users"  value={stats.active_users}   icon={UserCheck}    accent="text-[#138808]" border testid="admin-kpi-active" />
        <Kpi label="Total Scans"   value={stats.total_scans}    icon={TrendingUp}   accent="text-slate-900" border testid="admin-kpi-scans" />
        <Kpi label="Success Rate"  value={`${stats.success_rate}%`} icon={CheckCircle2} accent="text-[#138808]" testid="admin-kpi-rate" />
      </div>

      {/* Chart */}
      <div className="border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Uploads · Last 30 days</div>
            <div className="text-base font-semibold text-slate-900 mt-0.5">Activity</div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Legend color="#FF9933" label="Total" />
            <Legend color="#138808" label="Successful" />
          </div>
        </div>
        <div className="h-72" data-testid="admin-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.daily_uploads} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="rgb(226,232,240)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgb(100,116,139)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(226,232,240)" }}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "rgb(100,116,139)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgb(255,255,255)",
                  border: "1px solid rgb(226,232,240)",
                  borderRadius: 2,
                  fontSize: 12,
                  fontFamily: "IBM Plex Sans",
                }}
                labelStyle={{ color: "rgb(15,23,42)", fontFamily: "IBM Plex Mono", fontSize: 11 }}
              />
              <Line type="monotone" dataKey="count" stroke="#FF9933" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="successful" stroke="#138808" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Successful vs Failed */}
      <div className="border border-slate-200 bg-white p-5">
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-3">Outcome split</div>
        <div className="flex h-3 overflow-hidden border border-slate-200">
          <div
            className="bg-[#138808] transition-all duration-500"
            style={{ width: stats.total_scans ? `${(stats.successful / stats.total_scans) * 100}%` : "0%" }}
          />
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: stats.total_scans ? `${(stats.failed / stats.total_scans) * 100}%` : "0%" }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 text-sm">
          <div className="flex items-center gap-2 text-[#138808]">
            <CheckCircle2 className="h-4 w-4" /> {stats.successful} successful
          </div>
          <div className="flex items-center gap-2 text-red-600 justify-end">
            <AlertCircle className="h-4 w-4" /> {stats.failed} failed
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent, border, testid }) {
  return (
    <div
      className={[
        "p-5 flex items-center justify-between",
        border ? "lg:border-l border-slate-200" : "",
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

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ----------------------------- Users ----------------------------- */
function UsersTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data);
    } catch (e) {
      toast.error("Couldn't load users", { description: apiErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        (u.name || "").toLowerCase().includes(s)
    );
  }, [users, q]);

  const patch = async (u, body, label) => {
    setBusyId(u.id);
    try {
      const { data } = await api.patch(`/admin/users/${u.id}`, body);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)));
      toast.success(label || "Updated");
    } catch (e) {
      toast.error("Update failed", { description: apiErrorMessage(e) });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Permanently delete ${u.email} and all their scans?`)) return;
    setBusyId(u.id);
    try {
      await api.delete(`/admin/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success(`${u.email} deleted`);
    } catch (e) {
      toast.error("Delete failed", { description: apiErrorMessage(e) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3 fade-up">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center border border-slate-300 bg-white focus-within:border-[#FF9933]">
          <Search className="h-4 w-4 text-slate-400 ml-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email"
            data-testid="admin-users-search"
            className="flex-1 px-3 py-2 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500" data-testid="admin-users-count">
          {filtered.length} / {users.length}
        </div>
      </div>

      <div className="border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm" data-testid="admin-users-table">
            <thead className="bg-[#F8FAFC] border-b border-slate-200">
              <tr className="text-left">
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Scans</Th>
                <Th>Joined</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = me?.id === u.id;
                return (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`admin-user-row-${u.id}`}>
                    <Td>
                      <div className="font-medium text-slate-900">{u.name || "—"}</div>
                      <div className="mono text-xs text-slate-500">{u.email}</div>
                    </Td>
                    <Td>
                      {u.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 text-[#FF9933] bg-[#FFF4E5] border border-[#FFD8A8] px-2 py-0.5 text-xs font-medium rounded-sm">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-700 border border-slate-200 px-2 py-0.5 text-xs font-medium rounded-sm">
                          User
                        </span>
                      )}
                    </Td>
                    <Td>
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[#138808] bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium rounded-sm">
                          <ShieldCheck className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium rounded-sm">
                          <UserX className="h-3 w-3" /> Disabled
                        </span>
                      )}
                    </Td>
                    <Td className="mono">
                      <span className="text-slate-900">{u.scan_count}</span>
                      <span className="text-slate-400"> · {u.success_count} ok</span>
                    </Td>
                    <Td className="mono text-xs text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <SmallBtn
                          disabled={isSelf || busyId === u.id}
                          onClick={() => patch(u, { is_active: !u.is_active }, u.is_active ? "User disabled" : "User enabled")}
                          testid={`admin-toggle-active-${u.id}`}
                        >
                          {u.is_active ? "Disable" : "Enable"}
                        </SmallBtn>
                        <SmallBtn
                          disabled={isSelf || busyId === u.id}
                          onClick={() => patch(u, { role: u.role === "admin" ? "user" : "admin" }, "Role updated")}
                          testid={`admin-toggle-role-${u.id}`}
                        >
                          {u.role === "admin" ? "Demote" : "Promote"}
                        </SmallBtn>
                        <SmallBtn
                          variant="danger"
                          disabled={isSelf || busyId === u.id}
                          onClick={() => remove(u)}
                          testid={`admin-delete-${u.id}`}
                        >
                          {busyId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </SmallBtn>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SmallBtn({ children, onClick, disabled, variant = "default", testid }) {
  const cls =
    variant === "danger"
      ? "border-slate-200 hover:border-red-300 hover:text-red-600 text-slate-600"
      : "border-slate-200 hover:border-[#FF9933] hover:text-[#FF9933] text-slate-600";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={[
        "inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white",
        cls,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Audit ----------------------------- */
function AuditTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/audit", { params: { limit: 100 } });
        setItems(data);
      } catch (e) {
        toast.error("Couldn't load audit log", { description: apiErrorMessage(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="border border-slate-200 bg-white fade-up" data-testid="admin-audit-list">
      {loading ? (
        <div className="p-10 flex items-center justify-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-slate-500 text-sm">No audit entries yet.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((e) => (
            <li key={e.id} className="px-4 py-3 flex items-start gap-3" data-testid={`audit-row-${e.id}`}>
              <div className="mt-1 h-2 w-2 rounded-full bg-[#FF9933] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-medium text-slate-900">{prettyAction(e.action)}</div>
                  <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="mono text-xs text-slate-500 truncate">
                  {e.actor_email || "system"}
                  {e.target_email ? ` → ${e.target_email}` : ""}
                </div>
                {e.details && Object.keys(e.details).length > 0 && (
                  <div className="mt-1 mono text-[11px] text-slate-500 truncate">
                    {JSON.stringify(e.details)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function prettyAction(a) {
  switch (a) {
    case "user_register": return "User registered";
    case "user_login": return "User logged in";
    case "admin_update_user": return "Admin updated user";
    case "admin_delete_user": return "Admin deleted user";
    default: return a;
  }
}

/* shared cells */
function Th({ children, className = "" }) {
  return (
    <th className={`mono text-[10px] uppercase tracking-[0.2em] text-slate-500 px-4 py-2.5 font-normal ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-2.5 text-slate-700 align-top ${className}`}>{children}</td>;
}
