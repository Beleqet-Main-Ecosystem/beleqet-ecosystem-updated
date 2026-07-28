"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePlanDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const create_plan_dto_1 = require("./create-plan.dto");
class UpdatePlanDto extends (0, swagger_1.PartialType)(create_plan_dto_1.CreatePlanDto) {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.UpdatePlanDto = UpdatePlanDto;
//# sourceMappingURL=update-plan.dto.js.map