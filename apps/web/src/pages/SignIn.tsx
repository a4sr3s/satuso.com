import { SignIn } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

export default function SignInPage() {
  const { t } = useTranslation('auth');

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Sign In Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white min-h-screen">
        {/* Logo */}
        <a href="https://satuso.com">
          <img src="/logo.svg" alt="Satuso" className="h-20 mb-8" />
        </a>

        {/* Clerk SignIn */}
        <SignIn
          routing="hash"
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
              rootBox: 'w-full max-w-sm',
              card: 'shadow-none border border-gray-200 rounded-xl',
              formButtonPrimary: 'bg-gray-900 hover:bg-gray-800',
            },
          }}
        />
      </div>

      {/* Right Panel - Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 text-white p-12 flex-col items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold mb-4">
            {t('signIn.marketing.headline')}
          </h1>
          <p className="text-lg text-gray-400 mb-8">
            {t('signIn.marketing.subheadline')}
          </p>

          <div className="space-y-4 inline-block text-left">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">{t('signIn.marketing.features.pipeline')}</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">{t('signIn.marketing.features.reminders')}</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">{t('signIn.marketing.features.contacts')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
