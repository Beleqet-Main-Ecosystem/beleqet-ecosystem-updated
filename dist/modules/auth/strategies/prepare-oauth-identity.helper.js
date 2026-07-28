"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareOAuthIdentity = prepareOAuthIdentity;
function prepareOAuthIdentity(profile, tokenCipher) {
    return {
        profile,
        encryptedAccessToken: tokenCipher.encrypt(profile.rawAccessToken),
        encryptedRefreshToken: profile.rawRefreshToken
            ? tokenCipher.encrypt(profile.rawRefreshToken)
            : undefined,
    };
}
//# sourceMappingURL=prepare-oauth-identity.helper.js.map