import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-2xl">S</span>
            </div>
            <span className="text-2xl font-bold text-text-primary">Satuso</span>
          </div>
          <p className="text-text-secondary">Never lose a deal again</p>
        </div>

        {/* Clerk SignIn */}
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'w-full shadow-card border border-border rounded-xl',
              headerTitle: 'text-xl font-semibold text-text-primary',
              headerSubtitle: 'text-text-secondary',
              socialButtonsBlockButton: 'border border-border hover:bg-surface transition-colors',
              socialButtonsBlockButtonText: 'text-text-primary font-medium',
              dividerLine: 'bg-border',
              dividerText: 'text-text-muted',
              formFieldLabel: 'text-sm font-medium text-text-primary',
              formFieldInput: 'border-border focus:ring-2 focus:ring-primary focus:border-primary rounded-lg',
              formButtonPrimary: 'bg-primary hover:bg-primary/90 text-white font-medium rounded-lg h-10',
              footerActionLink: 'text-primary hover:text-primary/80 font-medium',
              identityPreviewEditButton: 'text-primary',
              formFieldAction: 'text-primary hover:text-primary/80',
              alert: 'rounded-lg',
            },
          }}
        />
      </div>
    </div>
  );
}
