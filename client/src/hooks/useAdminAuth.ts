import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';

export function useAdminAuth() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

  // Query to verify admin token
  const { data: adminData, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['/api/admin/auth/me'],
    enabled: !!adminToken,
    retry: false,
    queryFn: async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('No admin token');
      }

      return authRequest<any>('/api/admin/auth/me', {
        Authorization: `Bearer ${token}`,
      }, () => localStorage.removeItem('adminToken'));
    },
  });

  useEffect(() => {
    if (!adminToken) {
      setIsAdminAuthenticated(false);
      setIsLoading(false);
      return;
    }

    if (!queryLoading) {
      setIsAdminAuthenticated(!!adminData);
      setIsLoading(false);
    }
  }, [adminToken, adminData, queryLoading]);

  const adminLogout = () => {
    setIsAdminAuthenticated(false);
    localStorage.removeItem('adminToken');
  };

  return {
    isAdminAuthenticated,
    admin: adminData,
    adminLogout,
    authError: queryError instanceof Error ? queryError.message : undefined,
    retryAuth: refetch,
    isLoading: isLoading || queryLoading
  };
}
