"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nValidationException = void 0;
const common_1 = require("@nestjs/common");
const utils_1 = require("../utils");
class I18nValidationException extends common_1.HttpException {
    constructor(errors, status = common_1.HttpStatus.BAD_REQUEST, errorsAlreadyTranslated = false) {
        super((0, utils_1.httpStatusToMessage)(status), status);
        this.errors = errors;
        this.errorsAlreadyTranslated = errorsAlreadyTranslated;
    }
}
exports.I18nValidationException = I18nValidationException;
//# sourceMappingURL=i18n-validation-error.interface.js.map