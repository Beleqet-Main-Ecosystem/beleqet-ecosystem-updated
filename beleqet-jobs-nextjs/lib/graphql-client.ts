import { GraphQLClient } from 'graphql-request';

// We extract the base URL and point to our new GraphQL endpoint
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const GRAPHQL_ENDPOINT = `${API_URL}/graphql`;

export const gqlClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  headers: {
    // Authentication headers can be dynamically injected here for protected mutations
  },
});
