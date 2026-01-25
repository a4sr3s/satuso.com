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
    isActive: data?.data?.status === 'active',
    onboardingCompleted: data?.data?.onboardingCompleted ?? false,
    isLoading,
  };
}
