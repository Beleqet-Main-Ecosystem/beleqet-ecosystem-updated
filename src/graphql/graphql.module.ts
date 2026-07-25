import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import * as depthLimit from 'graphql-depth-limit';
import { ComplexityPlugin } from './plugins/complexity.plugin';

// In production Docker the src/ directory is not present (only dist/ is
// copied). Writing autoSchemaFile to src/ would crash the container on boot.
// Use /tmp (always writable) in production, and the conventional src/ path in
// development so the file is generated alongside the source for IDE tooling.
const schemaPath =
  process.env.NODE_ENV === 'production'
    ? '/tmp/schema.gql'
    : join(process.cwd(), 'src/graphql/schema.gql');

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: schemaPath,
      sortSchema: true,
      path: '/api/v1/graphql', // Explicitly bind to the global prefix route
      playground: true, // Enable legacy playground (works perfectly offline/behind VPN)
      plugins: [], // Disable Apollo Sandbox since it requires CDN access
      introspection: true,
      validationRules: [depthLimit(5)], // Protect against deeply nested queries
      context: ({ req, res }: { req: any; res: any }) => ({ req, res }), // Pass request object down for auth guards
      formatError: (formattedError, _error: any) => {
        // Global error formatting
        return formattedError;
      },
    }),
  ],
  providers: [ComplexityPlugin],
})
export class GraphqlConfigModule {}
