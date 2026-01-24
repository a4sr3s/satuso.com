import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';

export default function BillingSuccessPage() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['billing', 'subscription', 'poll'],
    queryFn: () => billingApi.getSubscription(),
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (data?.data?.status === 'active') {
      navigate('/', { replace: true });
    }
  }, [data, navigate]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Payment successful</h1>
        <p className="text-text-secondary text-sm mb-4">
          Your subscription is being activated. You'll be redirected to your dashboard shortly.
        </p>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    </div>
  );
}
