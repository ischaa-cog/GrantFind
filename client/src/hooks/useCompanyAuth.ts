import { useQuery } from "@tanstack/react-query";
import { authRequest } from "@/lib/authRequest";

export function useCompanyAuth() {
  const { data: company, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/company/auth/me"],
    queryFn: () => {
      const token = localStorage.getItem("companyToken");
      if (!token) return Promise.resolve(null);
      return authRequest("/api/company/auth/me", {
        Authorization: `Bearer ${token}`,
      }, () => localStorage.removeItem("companyToken"));
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  return {
    company,
    isLoading,
    authError: error instanceof Error ? error.message : undefined,
    retryAuth: refetch,
    isAuthenticated: !!company,
  };
}