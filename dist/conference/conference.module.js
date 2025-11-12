"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceModule = void 0;
const common_1 = require("@nestjs/common");
const conference_service_1 = require("./conference.service");
const conference_controller_1 = require("./conference.controller");
let ConferenceModule = class ConferenceModule {
};
exports.ConferenceModule = ConferenceModule;
exports.ConferenceModule = ConferenceModule = __decorate([
    (0, common_1.Module)({
        providers: [conference_service_1.ConferenceService],
        controllers: [conference_controller_1.ConferenceController],
        exports: [conference_service_1.ConferenceService],
    })
], ConferenceModule);
//# sourceMappingURL=conference.module.js.map