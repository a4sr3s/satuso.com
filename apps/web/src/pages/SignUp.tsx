import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding & Graphics */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-xl font-semibold">Satuso</span>
          </div>

          {/* Main content */}
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Start Closing<br />
              <span className="text-white/90">More Deals Today</span>
            </h1>
            <p className="text-lg text-white/80 max-w-md leading-relaxed">
              Join thousands of solopreneurs and small teams who've simplified their sales process with Satuso.
            </p>

            {/* Feature highlights */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white/90">Free to get started</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white/90">Set up in under 5 minutes</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white/90">No credit card required</span>
              </div>
            </div>
          </div>

          {/* Stats or social proof */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-3xl font-bold">2,500+</div>
              <div className="text-sm text-white/70">Active users</div>
            </div>
            <div>
              <div className="text-3xl font-bold">$4.2M</div>
              <div className="text-sm text-white/70">Deals closed</div>
            </div>
            <div>
              <div className="text-3xl font-bold">98%</div>
              <div className="text-sm text-white/70">Satisfaction</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-surface overflow-y-auto">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-2xl">S</span>
              </div>
              <span className="text-2xl font-bold text-text-primary">Satuso</span>
            </div>
            <p className="text-text-secondary">Never lose a deal again</p>
          </div>

          {/* Clerk SignUp */}
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/"
            appearance={{
              variables: {
                colorPrimary: '#171717',
                colorText: '#171717',
                colorTextSecondary: '#525252',
                colorBackground: '#FAFAFA',
                colorInputBackground: '#FFFFFF',
                colorInputText: '#171717',
                borderRadius: '0.5rem',
              },
              elements: {
                rootBox: 'w-full',
                card: 'w-full shadow-none bg-transparent',
                socialButtonsBlockButton: 'border border-border bg-white hover:bg-surface-hover',
                formButtonPrimary: 'bg-primary hover:bg-primary-hover',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
