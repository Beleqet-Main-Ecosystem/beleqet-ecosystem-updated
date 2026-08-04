import { useQuery } from '@tanstack/react-query';
import { gql } from 'graphql-request';
import { gqlClient } from '../lib/graphql-client';

// We explicitly select ONLY the exact fields we need for the UI to prevent over-fetching
export const GET_JOBS_QUERY = gql`
  query GetJobs($query: QueryJobsInput) {
    jobs(query: $query) {
      items {
        id
        title
        location
        type
        createdAt
        featured
        description
        company {
          name
          logo
        }
        category {
          label
          slug
        }
      }
      total
      page
      totalPages
    }
  }
`;

export function useJobsGraphQL(query: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['jobs', 'graphql', query],
    queryFn: async () => {
      const data = await gqlClient.request<{ jobs: any }>(GET_JOBS_QUERY, { query });
      return data.jobs;
    },
    staleTime: 60000, // 1 minute cache
  });
}
