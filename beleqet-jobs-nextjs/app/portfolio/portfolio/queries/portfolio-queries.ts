"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchPortfolioFromApi,
  savePortfolioToApi,
} from "../services/portfolio-api";
import { portfolioQueryKeys } from "../queries/query-keys";
import type { MasterProfileData } from "../types";

/**
 * Loads persisted portfolio for authenticated users via TanStack Query.
 *
 * @param enabled - Whether the query should run (typically when user is logged in).
 */
export function usePortfolioQuery(enabled: boolean) {
  return useQuery({
    queryKey: portfolioQueryKeys.detail(),
    queryFn: fetchPortfolioFromApi,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * Persists portfolio data to the backend for authenticated users.
 */
export function useSavePortfolioMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MasterProfileData) => savePortfolioToApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioQueryKeys.detail() });
    },
  });
}
