"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoInterviewModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const queues_constants_1 = require("../queues/queues.constants");
const video_interview_controller_1 = require("./video-interview.controller");
const video_interview_service_1 = require("./video-interview.service");
const video_interview_processor_1 = require("./video-interview.processor");
const circuit_breaker_service_1 = require("./circuit-breaker.service");
const ffmpeg_service_1 = require("./ffmpeg.service");
const query_monitor_service_1 = require("./query-monitor.service");
let VideoInterviewModule = class VideoInterviewModule {
};
exports.VideoInterviewModule = VideoInterviewModule;
exports.VideoInterviewModule = VideoInterviewModule = __decorate([
    (0, common_1.Module)({
        imports: [bullmq_1.BullModule.registerQueue({ name: queues_constants_1.QUEUE_NAMES.VIDEO_INTERVIEW })],
        controllers: [video_interview_controller_1.VideoInterviewController],
        providers: [
            video_interview_service_1.VideoInterviewService,
            video_interview_processor_1.VideoInterviewProcessor,
            circuit_breaker_service_1.CircuitBreakerService,
            ffmpeg_service_1.FfmpegService,
            query_monitor_service_1.QueryMonitorService,
        ],
        exports: [video_interview_service_1.VideoInterviewService, circuit_breaker_service_1.CircuitBreakerService, query_monitor_service_1.QueryMonitorService],
    })
], VideoInterviewModule);
//# sourceMappingURL=video-interview.module.js.map