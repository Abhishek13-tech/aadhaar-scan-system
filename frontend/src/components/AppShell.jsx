import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  ScanLine,
  History as HistoryIcon,
  User,
  LogOut,
  Menu,
  ShieldCheck,
  Shield,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const BASE_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/upload", label: "Upload", icon: ScanLine },
  { to: "/history", label: "History", icon: HistoryIcon },
  { to: "/profile", label: "Profile", icon: User },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const NAV =
    user && user.role === "admin"
      ? [...BASE_NAV, { to: "/admin", label: "Admin", icon: Shield }]
      : BASE_NAV;

  const SidebarBody = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
        <div className="h-9 w-9 border-2 border-[#FF9933] flex items-center justify-center bg-white">
          <ShieldCheck className="h-5 w-5 text-[#FF9933]" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Aadhaar</div>
          <div className="font-semibold text-slate-900 text-sm">Scan Console</div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            data-testid={`nav-${label.toLowerCase()}`}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2.5 text-sm rounded-sm transition-colors border-l-2",
                isActive
                  ? "bg-[#FFF4E5] text-slate-900 border-[#FF9933] font-medium"
                  : "text-slate-600 hover:bg-slate-50 border-transparent",
              ].join(" ")
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {label === "Admin" && (
              <span className="ml-auto mono text-[9px] uppercase tracking-[0.2em] text-[#FF9933]">★</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-200 space-y-3">
        <button
          type="button"
          onClick={toggleTheme}
          data-testid="theme-toggle"
          className="w-full flex items-center justify-between gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-sm px-3 py-2 transition-colors mono uppercase tracking-[0.15em]"
        >
          <span className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            {theme === "dark" ? "Dark" : "Light"} mode
          </span>
          <span className="text-slate-400">⇄</span>
        </button>

        <div>
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Signed in</div>
          <div className="text-sm font-medium text-slate-900 truncate" data-testid="sidebar-user-name">
            {user && typeof user === "object" ? user.name : ""}
          </div>
          <div className="text-xs text-slate-500 truncate" data-testid="sidebar-user-email">
            {user && typeof user === "object" ? user.email : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          data-testid="logout-button"
          className="w-full flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm rounded-sm px-3 py-2 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-slate-200 bg-white sticky top-0 h-screen">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40" data-testid="mobile-drawer">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-white border-r border-slate-200 shadow-lg">
            {SidebarBody}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            data-testid="mobile-menu-button"
            className="p-2 -ml-2 rounded-sm hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 border-2 border-[#FF9933] flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-[#FF9933]" strokeWidth={2.5} />
            </div>
            <div className="font-semibold text-sm text-slate-900">Aadhaar Scan</div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            data-testid="theme-toggle-mobile"
            className="p-2 -mr-2 rounded-sm hover:bg-slate-100"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Moon className="h-5 w-5 text-slate-700" /> : <Sun className="h-5 w-5 text-slate-700" />}
          </button>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-10 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
