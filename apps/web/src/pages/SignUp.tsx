import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding & Graphics */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        {/* Decorative gradient blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
          <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Satuso</span>
          </div>

          {/* Main content */}
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight text-gray-900">
              Start Closing<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                More Deals Today
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-md leading-relaxed">
              Join thousands of solopreneurs and small teams who've simplified their sales process with Satuso.
            </p>

            {/* Feature highlights */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Free to get started</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Set up in under 5 minutes</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">No credit card required</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-3xl font-bold text-gray-900">2,500+</div>
              <div className="text-sm text-gray-500">Active users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">$4.2M</div>
              <div className="text-sm text-gray-500">Deals closed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">98%</div>
              <div className="text-sm text-gray-500">Satisfaction</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 min-h-screen lg:min-h-0 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white lg:overflow-y-auto">
        <div className="w-full max-w-sm my-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-2xl">S</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Satuso</span>
            </div>
            <p className="text-gray-600">Never lose a deal again</p>
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
                colorBackground: '#FFFFFF',
                colorInputBackground: '#FFFFFF',
                colorInputText: '#171717',
                borderRadius: '0.5rem',
              },
              elements: {
                rootBox: 'w-full',
                card: 'w-full shadow-none p-0',
                formButtonPrimary: 'bg-primary hover:bg-primary-hover',
              },
            }}
          />
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
