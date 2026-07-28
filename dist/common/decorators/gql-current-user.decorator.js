"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GqlCurrentUser = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
exports.GqlCurrentUser = (0, common_1.createParamDecorator)((_data, context) => {
    const ctx = graphql_1.GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
});
//# sourceMappingURL=gql-current-user.decorator.js.map