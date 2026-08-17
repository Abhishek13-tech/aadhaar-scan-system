import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
  ScanLine,
} from "lucide-react";

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/history");
      setItems(data);
    } catch (e) {
      toast.error("Couldn't load history", { description: apiErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this scan record? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.delete(`/history/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Record deleted");
    } catch (e) {
      toast.error("Couldn't delete", { description: apiErrorMessage(e) });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="history-page">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-slate-500">Module 03 — Archive</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 leading-none">
            Scan history
          </h1>
          <p className="mt-3 text-slate-600 text-sm max-w-xl">
            Records of your past scans. We never store the uploaded images — only the extracted
            fields (with Aadhaar numbers masked).
          </p>
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500" data-testid="history-count">
          {loading ? "…" : `${items.length} record${items.length === 1 ? "" : "s"}`}
        </div>
      </header>

      <div className="border border-slate-200 bg-white">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <ScanLine className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <div className="text-slate-600 mb-4">No scans yet.</div>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 bg-[#FF9933] hover:bg-[#E88422] text-white text-sm font-medium rounded-sm px-4 py-2 transition-colors"
            >
              <ScanLine className="h-4 w-4" /> Start a scan
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="history-table">
              <thead className="bg-[#F8FAFC] border-b border-slate-200">
                <tr className="text-left">
                  <Th>File</Th>
                  <Th>Name</Th>
                  <Th>DOB</Th>
                  <Th>Gender</Th>
                  <Th>Aadhaar</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`history-row-${r.id}`}>
                    <Td className="max-w-[200px] truncate">{r.filename || "—"}</Td>
                    <Td>{r.name || "—"}</Td>
                    <Td className="mono">{r.dob || "—"}</Td>
                    <Td>{r.gender || "—"}</Td>
                    <Td className="mono">{r.aadhaar_masked || "—"}</Td>
                    <Td>
                      {r.success ? (
                        <span className="inline-flex items-center gap-1 text-[#138808] bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium rounded-sm">
                          <CheckCircle2 className="h-3 w-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium rounded-sm">
                          <AlertCircle className="h-3 w-3" /> Failed
                        </span>
                      )}
                    </Td>
                    <Td className="mono text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</Td>
                    <Td className="text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        data-testid={`delete-${r.id}`}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-sm px-2 py-1 transition-colors disabled:opacity-50"
                      >
                        {deletingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Delete
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
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
