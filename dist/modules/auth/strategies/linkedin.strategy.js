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
exports.LinkedInStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_openidconnect_1 = require("passport-openidconnect");
const token_cipher_interface_1 = require("../interfaces/token-cipher.interface");
const oauth_profile_interface_1 = require("../interfaces/oauth-profile.interface");
const auth_config_1 = require("../config/auth.config");
const prepare_oauth_identity_helper_1 = require("./prepare-oauth-identity.helper");
const LINKEDIN_OIDC_ISSUER = 'https://www.linkedin.com/oauth';
const LINKEDIN_AUTHORIZATION_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
let LinkedInStrategy = class LinkedInStrategy extends (0, passport_1.PassportStrategy)(passport_openidconnect_1.Strategy, 'linkedin', true) {
    constructor(config, tokenCipher) {
        const options = {
            issuer: LINKEDIN_OIDC_ISSUER,
            authorizationURL: LINKEDIN_AUTHORIZATION_URL,
            tokenURL: LINKEDIN_TOKEN_URL,
            userInfoURL: LINKEDIN_USERINFO_URL,
            clientID: config.linkedinClientId,
            clientSecret: config.linkedinClientSecret,
            callbackURL: config.linkedinCallbackUrl,
            scope: ['openid', 'profile', 'email'],
        };
        super(options);
        this.tokenCipher = tokenCipher;
    }
    async validate(issuer, profile, context, idToken, accessToken, refreshToken) {
        void issuer;
        void context;
        void idToken;
        const claims = profile._json ?? {};
        const email = profile.emails?.[0]?.value ?? claims.email;
        if (email === undefined) {
            throw new Error('LinkedIn profile did not include an email address.');
        }
        const normalizedProfile = {
            provider: oauth_profile_interface_1.OAuthProvider.LINKEDIN,
            providerAccountId: claims.sub ?? profile.id,
            email,
            emailVerified: claims.email_verified === true,
            firstName: profile.name?.givenName ?? claims.given_name ?? '',
            lastName: profile.name?.familyName ?? claims.family_name ?? '',
            avatarUrl: profile.photos?.[0]?.value ?? claims.picture,
            rawAccessToken: accessToken,
            rawRefreshToken: refreshToken,
        };
        return (0, prepare_oauth_identity_helper_1.prepareOAuthIdentity)(normalizedProfile, this.tokenCipher);
    }
};
exports.LinkedInStrategy = LinkedInStrategy;
exports.LinkedInStrategy = LinkedInStrategy = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_config_1.AUTH_ENV_CONFIG)),
    __param(1, (0, common_1.Inject)(token_cipher_interface_1.TOKEN_CIPHER)),
    __metadata("design:paramtypes", [Object, Object])
], LinkedInStrategy);
//# sourceMappingURL=linkedin.strategy.js.map