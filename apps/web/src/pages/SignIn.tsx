import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
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
              Never Lose a<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                Deal Again
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-md leading-relaxed">
              Track leads, automate follow-ups, and close more sales — all in one simple platform built for solopreneurs and small teams.
            </p>

            {/* Feature highlights */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Visual pipeline management</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Automated follow-up reminders</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Simple contact management</span>
              </div>
            </div>
          </div>

          {/* Testimonial */}
          <div className="space-y-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <blockquote className="text-gray-600 italic">
              "Finally, a CRM that doesn't feel like enterprise software. Simple, fast, and actually helps me close deals."
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                JD
              </div>
              <div>
                <div className="font-medium text-gray-900">James Donovan</div>
                <div className="text-sm text-gray-500">Independent Consultant</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 min-h-screen lg:min-h-0 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white lg:overflow-y-auto">
        <div className="w-full max-w-sm">
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

          {/* Clerk SignIn */}
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
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
