import { useState } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { billingApi } from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';

const FEATURES = [
  'Unlimited contacts & companies',
  'Deal pipeline management',
  'AI-powered SPIN selling',
  'Task & activity tracking',
  'Custom workboards',
  'Team collaboration',
  'Email & calendar integrations',
  'Priority support',
];

export default function SubscribePage() {
  const { signOut } = useClerk();
  const { isInTrial, trialDaysRemaining, status } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingApi.createCheckoutSession();
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setLoading(false);
    }
  };

  // Determine if trial has expired (not in trial, not active subscription)
  const trialExpired = !isInTrial && status !== 'active' && status !== 'trialing';

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Subscribe Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white min-h-screen">
        {/* Logo */}
        <a href="https://satuso.com">
          <img src="/logo.svg" alt="Satuso" className="h-20 mb-8" />
        </a>

        {/* Subscribe Card */}
        <div className="w-full max-w-sm">
          {/* Trial Status Message */}
          {trialExpired && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm font-medium text-red-800">Your free trial has ended</p>
              <p className="text-xs text-red-600 mt-1">Subscribe now to continue using Satuso</p>
            </div>
          )}
          {isInTrial && trialDaysRemaining > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-medium text-blue-800">
                {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in your free trial
              </p>
              <p className="text-xs text-blue-600 mt-1">Subscribe to keep all your data after the trial ends</p>
            </div>
          )}

          <div className="border border-gray-200 rounded-xl p-6">
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">$29</span>
                <span className="text-gray-500">/month</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Standard plan</p>
            </div>

            <ul className="space-y-3 mb-6">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {error && (
              <p className="text-sm text-red-600 mb-4">{error}</p>
            )}

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Redirecting...' : 'Subscribe'}
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            Need a custom plan?{' '}
            <a href="https://satuso.com/contact-sales/" className="text-blue-600 hover:underline">
              Contact sales
            </a>
          </p>

          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-6"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Right Panel - Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 text-white p-12 flex-col items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold mb-4">
            Never Lose a Deal Again
          </h1>
          <p className="text-lg text-gray-400 mb-8">
            Track leads, automate follow-ups, and close more sales — all in one simple platform.
          </p>

          <div className="space-y-4 inline-block text-left">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">Visual pipeline management</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">Automated follow-up reminders</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300">Simple contact management</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
