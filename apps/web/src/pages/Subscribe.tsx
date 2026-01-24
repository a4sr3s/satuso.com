import { useState } from 'react';
import { billingApi } from '@/lib/api';

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

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary">Get started with Satuso</h1>
          <p className="text-text-secondary mt-2">
            Subscribe to access your CRM dashboard and start closing more deals.
          </p>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-text-primary">$29</span>
              <span className="text-text-muted">/month</span>
            </div>
            <p className="text-sm text-text-secondary mt-1">Standard plan</p>
          </div>

          <ul className="space-y-3 mb-6">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
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
            className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Redirecting to checkout...' : 'Subscribe'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-text-muted">
            Need a custom plan for your team?{' '}
            <a href="mailto:sales@satuso.com" className="text-blue-600 hover:underline">
              Contact sales
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
