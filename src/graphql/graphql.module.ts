import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
const depthLimit = require('graphql-depth-limit');
import { ComplexityPlugin } from './plugins/complexity.plugin';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      path: '/api/v1/graphql', // Explicitly bind to the global prefix route
      playground: false, // Disable legacy playground
      plugins: [ApolloServerPluginLandingPageLocalDefault()], // Enable modern Apollo Sandbox
      introspection: true,
      validationRules: [depthLimit(5)], // Protect against deeply nested queries
      context: ({ req, res }: { req: any; res: any }) => ({ req, res }), // Pass request object down for auth guards
      formatError: (formattedError, error: any) => {
        // Global error formatting
        return formattedError;
      },
    }),
  ],
  providers: [ComplexityPlugin],
})
export class GraphqlConfigModule {}
