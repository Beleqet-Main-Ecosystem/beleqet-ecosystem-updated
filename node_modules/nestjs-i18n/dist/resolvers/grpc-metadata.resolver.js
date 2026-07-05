"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrpcMetadataResolver = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("../decorators");
const i18n_constants_1 = require("../i18n.constants");
let GrpcMetadataResolver = class GrpcMetadataResolver {
    constructor(keys = ['lang']) {
        this.keys = keys;
    }
    async resolve(context) {
        let lang = undefined;
        switch (context.getType()) {
            case i18n_constants_1.ExecutionContextType.RPC:
                const metadata = context.switchToRpc().getContext();
                for (const key of this.keys) {
                    const [value] = metadata.get(key);
                    if (value) {
                        lang = value;
                        break;
                    }
                }
        }
        return lang;
    }
};
exports.GrpcMetadataResolver = GrpcMetadataResolver;
exports.GrpcMetadataResolver = GrpcMetadataResolver = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, decorators_1.I18nResolverOptions)()),
    __metadata("design:paramtypes", [Array])
], GrpcMetadataResolver);
//# sourceMappingURL=grpc-metadata.resolver.js.map