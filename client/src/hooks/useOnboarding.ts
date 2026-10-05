import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import type { UserBusiness } from '@shared/schema';

export function useOnboarding() {
  const { user, isAuthenticated } = useAuth();

  // Query user businesses to check if onboarding is needed
  const { data: businesses = [], isLoading: isLoadingBusinesses } = useQuery<UserBusiness[]>({
    queryKey: ['/api/user/businesses'],
    enabled: !!user,
    retry: false,
  });

  const needsOnboarding = isAuthenticated && user && !isLoadingBusinesses && businesses?.length === 0;

  return {
    needsOnboarding,
    isLoadingBusinesses,
    businesses,
  };
}