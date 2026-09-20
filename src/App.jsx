import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoleProvider } from './context/RoleContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import AppLayout from './layouts/AppLayout';
import { roleHome } from './config/navigation';

// Lazy-loaded pages (route-level code splitting)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RoleLoginPage = lazy(() => import('./pages/auth/RoleLoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ConsultationsHubPage = lazy(() => import('./pages/ConsultationsHubPage'));
const VideoConsultationPage = lazy(() => import('./pages/VideoConsultationPage'));
const InPersonConsultationPage = lazy(() => import('./pages/InPersonConsultationPage'));
const ConsultationWorkspacePage = lazy(() => import('./pages/ConsultationWorkspacePage'));
const PrescriptionStudioPage = lazy(() => import('./pages/PrescriptionStudioPage'));
const OCRPage = lazy(() => import('./pages/OCRPage'));
const FollowUpHubPage = lazy(() => import('./pages/FollowUpHubPage'));

const AdminWorkspace = lazy(() => import('./pages/admin/AdminWorkspace'));
const DoctorWorkspace = lazy(() => import('./pages/doctor/DoctorWorkspace'));
const LabWorkspace = lazy(() => import('./pages/lab/LabWorkspace'));
const PharmacyWorkspace = lazy(() => import('./pages/pharmacy/PharmacyWorkspace'));
const PatientWorkspace = lazy(() => import('./pages/patient/PatientWorkspace'));
const NurseDashboard = lazy(() => import('./pages/roles/NurseDashboard'));

const DemoPage = lazy(() => import('./pages/DemoPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AccessDeniedPage = lazy(() => import('./pages/AccessDeniedPage'));

/** Branded route-level loading fallback. */
function RouteFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-base)', color: 'var(--color-text-secondary)' }}>
      <div className="spinner-container">
        <span className="spinner" style={{ width: 34, height: 34 }} />
        <div className="flex items-center gap-2">
          <span
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'var(--gradient-primary)', color: '#fff', fontWeight: 800, fontSize: 13 }}
          >
            K
          </span>
          <span className="font-semibold">KENKO AI</span>
        </div>
        <p className="text-xs text-muted">Loading workspace…</p>
      </div>
    </div>
  );
}

/** Smart home redirect: send the user to their role workspace. */
function RoleHomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(user?.role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RoleProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Dedicated role login pages */}
                  <Route path="/login/admin" element={<RoleLoginPage roleKey="admin" />} />
                  <Route path="/admin/login" element={<RoleLoginPage roleKey="admin" />} />
                  <Route path="/login/doctor" element={<RoleLoginPage roleKey="doctor" />} />
                  <Route path="/doctor/login" element={<RoleLoginPage roleKey="doctor" />} />
                  <Route path="/login/nurse" element={<RoleLoginPage roleKey="nurse" />} />
                  <Route path="/nurse/login" element={<RoleLoginPage roleKey="nurse" />} />
                  <Route path="/login/lab" element={<RoleLoginPage roleKey="lab" />} />
                  <Route path="/lab/login" element={<RoleLoginPage roleKey="lab" />} />
                  <Route path="/login/pharmacy" element={<RoleLoginPage roleKey="pharmacist" />} />
                  <Route path="/pharmacy/login" element={<RoleLoginPage roleKey="pharmacist" />} />
                  <Route path="/login/patient" element={<RoleLoginPage roleKey="patient" />} />
                  <Route path="/patient/login" element={<RoleLoginPage roleKey="patient" />} />

                  {/* Protected app shell */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route
                      path="/admin"
                      element={
                        <RoleGuard allowedRoles={['admin']}>
                          <AdminWorkspace />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/doctor"
                      element={
                        <RoleGuard allowedRoles={['doctor', 'admin']}>
                          <DoctorWorkspace />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/nurse"
                      element={
                        <RoleGuard allowedRoles={['nurse', 'doctor', 'admin']}>
                          <NurseDashboard />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/lab"
                      element={
                        <RoleGuard allowedRoles={['lab', 'admin']}>
                          <LabWorkspace />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/pharmacy"
                      element={
                        <RoleGuard allowedRoles={['pharmacist', 'admin']}>
                          <PharmacyWorkspace />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientWorkspace />
                        </RoleGuard>
                      }
                    />

                    {/* Shared clinical workflows */}
                    <Route path="/dashboard" element={<RoleHomeRedirect />} />
                    <Route path="/consultations" element={<ConsultationsHubPage />} />
                    <Route path="/consultations/video" element={<VideoConsultationPage />} />
                    <Route path="/consultations/in-person" element={<InPersonConsultationPage />} />
                    <Route path="/consultations/:id" element={<ConsultationWorkspacePage />} />
                    <Route path="/prescriptions" element={<PrescriptionStudioPage />} />
                    <Route path="/ocr" element={<OCRPage />} />
                    <Route path="/followups" element={<FollowUpHubPage />} />

                    {/* Legacy compatibility routes */}
                    <Route path="/roles/doctor" element={<Navigate to="/doctor" replace />} />
                    <Route path="/roles/patient" element={<Navigate to="/patient" replace />} />
                    <Route path="/roles/admin" element={<Navigate to="/admin" replace />} />
                    <Route path="/roles/lab" element={<Navigate to="/lab" replace />} />
                    <Route path="/roles/nurse" element={<Navigate to="/nurse" replace />} />
                    <Route path="/roles/pharmacist" element={<Navigate to="/pharmacy" replace />} />

                    {/* 1-Click demo mode */}
                    <Route path="/demo" element={<DemoPage />} />
                  </Route>

                  {/* Root redirect */}
                  <Route path="/" element={<RoleHomeRedirect />} />

                  {/* Access-pending / unauthorized (authenticated but unassigned role) */}
                  <Route path="/unauthorized" element={<AccessDeniedPage />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </RoleProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}