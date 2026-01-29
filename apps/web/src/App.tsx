import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from '@clerk/clerk-react';
import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import AuthProvider from '@/components/AuthProvider';
import { useSubscription } from '@/hooks/useSubscription';
import { OfflineIndicator, InstallPrompt, UpdatePrompt } from '@/components/pwa';

// Direct imports for instant navigation
import SignInPage from '@/pages/SignIn';
import SignUpPage from '@/pages/SignUp';
import DashboardPage from '@/pages/Dashboard';
import ContactsPage from '@/pages/Contacts';
import ContactDetailPage from '@/pages/ContactDetail';
import CompaniesPage from '@/pages/Companies';
import CompanyDetailPage from '@/pages/CompanyDetail';
import DealsPage from '@/pages/Deals';
import DealDetailPage from '@/pages/DealDetail';
import TasksPage from '@/pages/Tasks';
import SettingsPage from '@/pages/Settings';
import WorkboardsPage from '@/pages/Workboards';
import WorkboardViewPage from '@/pages/WorkboardView';
import AIAssistantPage from '@/pages/AIAssistant';
import SubscribePage from '@/pages/Subscribe';
import BillingSuccessPage from '@/pages/BillingSuccess';
import OnboardingPage from '@/pages/Onboarding';

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
  const { isActive, onboardingCompleted, isLoading } = useSubscription();

  if (!isLoaded || isLoading) {
    return <FullPageLoader />;
  }

  return (
    <>
      <SignedIn>
        {!isActive ? (
          <Navigate to="/subscribe" replace />
        ) : !onboardingCompleted ? (
          <Navigate to="/onboarding" replace />
        ) : (
          children
        )}
      </SignedIn>
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
      {/* PWA Components */}
      <OfflineIndicator />
      <InstallPrompt />
      <UpdatePrompt />

      <Routes>
        {/* Auth routes - using hash routing so no splat needed */}
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        {/* Legacy route redirect */}
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />

        {/* Billing and onboarding routes - outside protected layout */}
        <Route path="/subscribe" element={<SubscribePage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

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
          <Route path="ai" element={<AIAssistantPage />} />
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
