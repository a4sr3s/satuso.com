import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from '@clerk/clerk-react';
import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import AuthProvider from '@/components/AuthProvider';

// Lazy load pages for code-splitting
const SignInPage = lazy(() => import('@/pages/SignIn'));
const SignUpPage = lazy(() => import('@/pages/SignUp'));
const DashboardPage = lazy(() => import('@/pages/Dashboard'));
const ContactsPage = lazy(() => import('@/pages/Contacts'));
const ContactDetailPage = lazy(() => import('@/pages/ContactDetail'));
const CompaniesPage = lazy(() => import('@/pages/Companies'));
const CompanyDetailPage = lazy(() => import('@/pages/CompanyDetail'));
const DealsPage = lazy(() => import('@/pages/Deals'));
const DealDetailPage = lazy(() => import('@/pages/DealDetail'));
const TasksPage = lazy(() => import('@/pages/Tasks'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const WorkboardsPage = lazy(() => import('@/pages/Workboards'));
const WorkboardViewPage = lazy(() => import('@/pages/WorkboardView'));

// Full page loader for auth state
function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-text-secondary">Loading Satuso...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <FullPageLoader />;
  }

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function App() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <FullPageLoader />;
  }

  return (
    <AuthProvider>
      <Routes>
        {/* Auth routes */}
        <Route path="/sign-in/*" element={<Suspense fallback={<FullPageLoader />}><SignInPage /></Suspense>} />
        <Route path="/sign-up/*" element={<Suspense fallback={<FullPageLoader />}><SignUpPage /></Suspense>} />
        {/* Legacy route redirect */}
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />

        {/* Protected routes - Layout has its own Suspense for content */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Layout />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/:id" element={<ContactDetailPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="companies/:id" element={<CompanyDetailPage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="deals/:id" element={<DealDetailPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="ai" element={<Navigate to="/" replace />} />
          <Route path="workboards" element={<WorkboardsPage />} />
          <Route path="workboards/:id" element={<WorkboardViewPage />} />
          <Route path="settings/*" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
