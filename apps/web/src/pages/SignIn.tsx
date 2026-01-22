import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding & Graphics */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
        {/* Animated blob decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 rounded-full mix-blend-overlay filter blur-3xl animate-blob" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/10 rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-4000" />
        </div>

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
              Never Lose a<br />
              <span className="text-white/90">Deal Again</span>
            </h1>
            <p className="text-lg text-white/80 max-w-md leading-relaxed">
              Track leads, automate follow-ups, and close more sales — all in one simple platform built for solopreneurs and small teams.
            </p>

            {/* Feature highlights */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white/90">Visual pipeline management</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white/90">Automated follow-up reminders</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white/90">Simple contact management</span>
              </div>
            </div>
          </div>

          {/* Testimonial or social proof */}
          <div className="space-y-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <blockquote className="text-white/90 italic">
              "Finally, a CRM that doesn't feel like enterprise software. Simple, fast, and actually helps me close deals."
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-sm font-medium">
                JD
              </div>
              <div>
                <div className="font-medium">James Donovan</div>
                <div className="text-sm text-white/70">Independent Consultant</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-2xl">S</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Satuso</span>
            </div>
            <p className="text-gray-600">Never lose a deal again</p>
          </div>

          {/* Welcome text - desktop only */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600">Sign in to your account to continue</p>
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
                card: 'w-full shadow-none border-0 p-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'border border-gray-200 hover:bg-gray-50 transition-colors rounded-lg h-11',
                socialButtonsBlockButtonText: 'text-gray-700 font-medium',
                dividerLine: 'bg-gray-200',
                dividerText: 'text-gray-500 text-sm',
                formFieldLabel: 'text-sm font-medium text-gray-700',
                formFieldInput: 'border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-lg h-11',
                formButtonPrimary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg h-11 shadow-lg shadow-purple-500/25',
                footerActionLink: 'text-purple-600 hover:text-purple-700 font-medium',
                identityPreviewEditButton: 'text-purple-600',
                formFieldAction: 'text-purple-600 hover:text-purple-700',
                alert: 'rounded-lg',
                footer: 'hidden',
              },
            }}
          />

          {/* Sign up link */}
          <p className="mt-8 text-center text-gray-600">
            Don't have an account?{' '}
            <a href="/sign-up" className="text-purple-600 hover:text-purple-700 font-medium">
              Sign up for free
            </a>
          </p>
        </div>
      </div>

      {/* Blob animation styles */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(30px, 10px) scale(1.05); }
        }
        .animate-blob {
          animation: blob 8s infinite ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
