import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/Upload";
import HistoryPage from "@/pages/History";
import ProfilePage from "@/pages/Profile";
import AdminPage from "@/pages/Admin";

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function Shell({ children }) {
  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"  element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />

      <Route path="/"        element={<ProtectedRoute><Shell><Dashboard /></Shell></ProtectedRoute>} />
      <Route path="/upload"  element={<ProtectedRoute><Shell><UploadPage /></Shell></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><Shell><HistoryPage /></Shell></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Shell><ProfilePage /></Shell></ProtectedRoute>} />
      <Route path="/admin"   element={<AdminRoute><Shell><AdminPage /></Shell></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </div>
  );
}

export default App;
