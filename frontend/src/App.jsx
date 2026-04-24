import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore.js';
import { useSyncQueue } from './hooks/useSyncQueue.js';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import JobDetailPage from './pages/JobDetailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import PipelineSetupPage from './pages/admin/PipelineSetupPage.jsx';
import StageMappingPage from './pages/admin/StageMappingPage.jsx';
import CrewManagementPage from './pages/admin/CrewManagementPage.jsx';
import AdminJobsPage from './pages/admin/AdminJobsPage.jsx';
import AdminInvoiceSettingsPage from './pages/admin/AdminInvoiceSettingsPage.jsx';
import AdminNotificationSettingsPage from './pages/admin/AdminNotificationSettingsPage.jsx';
import CrewMapPage from './pages/admin/CrewMapPage.jsx';
import CreateInvoicePage from './pages/CreateInvoicePage.jsx';

/**
 * ProtectedRoute — redirects unauthenticated users to the login page.
 * Wraps any route that requires a valid session.
 */
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  // Kick off the offline sync queue globally so it flushes on reconnection
  // regardless of which page the user is currently viewing.
  useSyncQueue();

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* Offline indicator renders on every page */}
      <OfflineBanner />
      {/* Update prompt — shown when a new SW version has taken control */}
      <UpdateBanner />

      <Routes>
        {/* Public */}
        <Route path="/" element={<LoginPage />} />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs/:id"
          element={
            <ProtectedRoute>
              <JobDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs/:id/create-invoice"
          element={
            <ProtectedRoute>
              <CreateInvoicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Admin — role-gated */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/pipeline"
          element={
            <AdminRoute>
              <PipelineSetupPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/stages"
          element={
            <AdminRoute>
              <StageMappingPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/crew"
          element={
            <AdminRoute>
              <CrewManagementPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/jobs"
          element={
            <AdminRoute>
              <AdminJobsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/invoice-settings"
          element={
            <AdminRoute>
              <AdminInvoiceSettingsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/notification-settings"
          element={
            <AdminRoute>
              <AdminNotificationSettingsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/crew-map"
          element={
            <AdminRoute>
              <CrewMapPage />
            </AdminRoute>
          }
        />

        {/* Catch-all — send unknown paths to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
