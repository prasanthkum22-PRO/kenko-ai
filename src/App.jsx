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

// Doctor application & moderation workflows
const ApplyDoctorPage = lazy(() => import('./pages/doctor/ApplyDoctorPage'));
const DoctorApplicationStatusPage = lazy(() => import('./pages/doctor/DoctorApplicationStatusPage'));
const DoctorPostsPage = lazy(() => import('./pages/doctor/DoctorPostsPage'));
const AdminControlCenter = lazy(() => import('./pages/admin/AdminControlCenter'));
const AdminApplicationReviewPage = lazy(() => import('./pages/admin/AdminApplicationReviewPage'));
const AdminPostReviewPage = lazy(() => import('./pages/admin/AdminPostReviewPage'));
const DoctorsDirectoryPage = lazy(() => import('./pages/DoctorsDirectoryPage'));
const PublicPostFeedPage = lazy(() => import('./pages/PublicPostFeedPage'));

// Post-Consultation Clinical Workspace & Follow-Up Intelligence
const DoctorConsultationWorkspacePage = lazy(() => import('./pages/doctor/DoctorConsultationWorkspacePage'));
const DoctorFollowUpDashboardPage = lazy(() => import('./pages/doctor/DoctorFollowUpDashboardPage'));
const DoctorFollowUpDetailPage = lazy(() => import('./pages/doctor/DoctorFollowUpDetailPage'));
const DoctorPatientDetailPage = lazy(() => import('./pages/doctor/DoctorPatientDetailPage'));
const PatientDashboardPage = lazy(() => import('./pages/patient/PatientDashboardPage'));
const PatientCareJourneyPage = lazy(() => import('./pages/patient/PatientCareJourneyPage'));
const PatientMedicationsPage = lazy(() => import('./pages/patient/PatientMedicationsPage'));
const PatientConditionCheckInPage = lazy(() => import('./pages/patient/PatientConditionCheckInPage'));
const PatientActivityPage = lazy(() => import('./pages/patient/PatientActivityPage'));
const PatientHealthSummaryPage = lazy(() => import('./pages/patient/PatientHealthSummaryPage'));
const PatientCalendarPage = lazy(() => import('./pages/patient/PatientCalendarPage'));
const PatientDocumentsPage = lazy(() => import('./pages/patient/PatientDocumentsPage'));
const PatientFollowUpPage = lazy(() => import('./pages/patient/PatientFollowUpPage'));
const PatientHealthTimelinePage = lazy(() => import('./pages/patient/PatientHealthTimelinePage'));
const NotificationCenterPage = lazy(() => import('./pages/NotificationCenterPage'));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferencesPage'));

const DemoPage = lazy(() => import('./pages/DemoPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
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

/** Smart home redirect: send authenticated users to workspace, guests to landing page. */
function RoleHomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <LandingPage />;
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
                  <Route path="/landing" element={<LandingPage />} />
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
                      path="/patient/workspace"
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

                    {/* Doctor Application & Status */}
                    <Route
                      path="/apply-doctor"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <ApplyDoctorPage />
                        </RoleGuard>
                      }
                    />
                    <Route path="/apply-doctor/status" element={<DoctorApplicationStatusPage />} />
                    <Route path="/doctor-application-status" element={<Navigate to="/apply-doctor/status" replace />} />

                    {/* Doctor Posts */}
                    <Route
                      path="/doctor/posts"
                      element={
                        <RoleGuard allowedRoles={['doctor', 'admin']}>
                          <DoctorPostsPage />
                        </RoleGuard>
                      }
                    />

                    {/* Admin Moderation & Control Center */}
                    <Route
                      path="/admin/doctors/applications"
                      element={
                        <RoleGuard allowedRoles={['admin']}>
                          <AdminControlCenter initialTab="applications" />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/admin/posts"
                      element={
                        <RoleGuard allowedRoles={['admin']}>
                          <AdminControlCenter initialTab="posts" />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/admin/audit"
                      element={
                        <RoleGuard allowedRoles={['admin']}>
                          <AdminControlCenter initialTab="audit" />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/admin/applications/:id"
                      element={
                        <RoleGuard allowedRoles={['admin']}>
                          <AdminApplicationReviewPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/admin/posts/:id"
                      element={
                        <RoleGuard allowedRoles={['admin']}>
                          <AdminPostReviewPage />
                        </RoleGuard>
                      }
                    />

                    {/* Post-Consultation Clinical Workspace & Follow-Up Routes */}
                    <Route
                      path="/doctor/consultations/:id"
                      element={
                        <RoleGuard allowedRoles={['doctor', 'admin']}>
                          <DoctorConsultationWorkspacePage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/doctor/consultations/:id/prescription"
                      element={
                        <RoleGuard allowedRoles={['doctor', 'admin']}>
                          <DoctorConsultationWorkspacePage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/doctor/follow-up"
                      element={
                        <RoleGuard allowedRoles={['doctor', 'admin']}>
                          <DoctorFollowUpDashboardPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/doctor/follow-up/:id"
                      element={
                        <RoleGuard allowedRoles={['doctor', 'admin']}>
                          <DoctorFollowUpDetailPage />
                        </RoleGuard>
                      }
                    />
                    {/* Patient Health Dashboard & Care System */}
                    <Route
                      path="/patient"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientDashboardPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/dashboard"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientDashboardPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/care-journey"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientCareJourneyPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/medications"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientMedicationsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/medications/history"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientMedicationsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/follow-up/:id/check-in"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientConditionCheckInPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/activity"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientActivityPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/health-summary"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientHealthSummaryPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/calendar"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientCalendarPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/patient/documents"
                      element={
                        <RoleGuard allowedRoles={['patient', 'admin']}>
                          <PatientDocumentsPage />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="/doctor/patients/:patientId"
                      element={
                        <RoleGuard allowedRoles={['doctor', 'admin']}>
                          <DoctorPatientDetailPage />
                        </RoleGuard>
                      }
                    />
                    <Route path="/notifications" element={<NotificationCenterPage />} />
                    <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />

                    {/* Public Doctor Directory & Health Posts */}
                    <Route path="/doctors" element={<DoctorsDirectoryPage />} />
                    <Route path="/posts" element={<PublicPostFeedPage />} />

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