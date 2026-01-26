import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';

export function useSubscription() {
  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => billingApi.getSubscription(),
    staleTime: 30_000,
  });

  return {
    status: data?.data?.status ?? 'inactive',
    isActive: data?.data?.isActive ?? false,
    onboardingCompleted: data?.data?.onboardingCompleted ?? false,
    isInTrial: data?.data?.isInTrial ?? false,
    trialEndsAt: data?.data?.trialEndsAt ?? null,
    trialDaysRemaining: data?.data?.trialDaysRemaining ?? 0,
    isLoading,
  };
}
