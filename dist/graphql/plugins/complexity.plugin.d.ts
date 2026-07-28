import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { GraphQLSchemaHost } from '@nestjs/graphql';
export declare class ComplexityPlugin implements ApolloServerPlugin {
    private gqlSchemaHost;
    constructor(gqlSchemaHost: GraphQLSchemaHost);
    requestDidStart(): Promise<GraphQLRequestListener<any>>;
}
