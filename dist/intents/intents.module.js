"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentsModule = void 0;
const common_1 = require("@nestjs/common");
const intents_service_1 = require("./intents.service");
const contacts_module_1 = require("../contacts/contacts.module");
let IntentsModule = class IntentsModule {
};
exports.IntentsModule = IntentsModule;
exports.IntentsModule = IntentsModule = __decorate([
    (0, common_1.Module)({
        imports: [contacts_module_1.ContactsModule],
        providers: [intents_service_1.IntentsService],
        exports: [intents_service_1.IntentsService],
    })
], IntentsModule);
//# sourceMappingURL=intents.module.js.map