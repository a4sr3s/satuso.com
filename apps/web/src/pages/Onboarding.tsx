import { CreateOrganization } from '@clerk/clerk-react';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Welcome to Satuso</h1>
          <p className="text-text-secondary mt-2">
            Create your organization to get started.
          </p>
        </div>

        <CreateOrganization
          afterCreateOrganizationUrl="/"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-sm border border-border rounded-xl',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
            },
          }}
        />
      </div>
    </div>
  );
}
