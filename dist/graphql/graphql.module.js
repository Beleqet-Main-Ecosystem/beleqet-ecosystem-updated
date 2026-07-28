"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphqlConfigModule = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const apollo_1 = require("@nestjs/apollo");
const path_1 = require("path");
const depthLimit = require("graphql-depth-limit");
const complexity_plugin_1 = require("./plugins/complexity.plugin");
const schemaPath = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
    ? '/tmp/schema.gql'
    : (0, path_1.join)(process.cwd(), 'src/graphql/schema.gql');
let GraphqlConfigModule = class GraphqlConfigModule {
};
exports.GraphqlConfigModule = GraphqlConfigModule;
exports.GraphqlConfigModule = GraphqlConfigModule = __decorate([
    (0, common_1.Module)({
        imports: [
            graphql_1.GraphQLModule.forRoot({
                driver: apollo_1.ApolloDriver,
                autoSchemaFile: schemaPath,
                sortSchema: true,
                path: '/api/v1/graphql',
                playground: true,
                plugins: [],
                introspection: true,
                validationRules: [depthLimit(5)],
                context: ({ req, res }) => ({ req, res }),
                formatError: (formattedError, _error) => {
                    return formattedError;
                },
            }),
        ],
        providers: [complexity_plugin_1.ComplexityPlugin],
    })
], GraphqlConfigModule);
//# sourceMappingURL=graphql.module.js.map