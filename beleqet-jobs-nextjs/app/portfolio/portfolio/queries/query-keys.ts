/** TanStack Query keys for portfolio server state. */
export const portfolioQueryKeys = {
  all: ["portfolio"] as const,
  detail: () => [...portfolioQueryKeys.all, "detail"] as const,
};
