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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const phone_util_1 = require("../common/utils/phone.util");
const logger_service_1 = require("../common/logger/logger.service");
let ContactsService = class ContactsService {
    logger;
    contactsFilePath;
    contactsCache = {};
    constructor(logger) {
        this.logger = logger;
        this.contactsFilePath = (0, path_1.join)(process.cwd(), 'contacts.json');
        this.loadContacts();
    }
    loadContacts() {
        try {
            if ((0, fs_1.existsSync)(this.contactsFilePath)) {
                const data = (0, fs_1.readFileSync)(this.contactsFilePath, 'utf-8');
                this.contactsCache = JSON.parse(data);
                this.logger.log('Contacts loaded successfully', {
                    count: Object.keys(this.contactsCache).length,
                });
            }
            else {
                this.contactsCache = {};
                this.saveContacts();
                this.logger.log('Created new contacts file');
            }
        }
        catch (error) {
            this.logger.error('Failed to load contacts', error.message, { error });
            this.contactsCache = {};
        }
    }
    saveContacts() {
        try {
            (0, fs_1.writeFileSync)(this.contactsFilePath, JSON.stringify(this.contactsCache, null, 2), 'utf-8');
            this.logger.log('Contacts saved successfully');
        }
        catch (error) {
            this.logger.error('Failed to save contacts', error.message, { error });
        }
    }
    getAllContacts() {
        return { ...this.contactsCache };
    }
    getContact(name) {
        const normalizedName = name.toLowerCase().trim();
        return this.contactsCache[normalizedName] || null;
    }
    updateContacts(contacts) {
        const normalized = {};
        for (const [name, number] of Object.entries(contacts)) {
            const normalizedNumber = (0, phone_util_1.normalizeToE164)(number);
            if (normalizedNumber) {
                normalized[name.toLowerCase().trim()] = normalizedNumber;
            }
            else {
                this.logger.warn('Skipping invalid phone number', {
                    name,
                    number,
                });
            }
        }
        this.contactsCache = normalized;
        this.saveContacts();
        return this.contactsCache;
    }
    addContact(name, number) {
        const normalizedNumber = (0, phone_util_1.normalizeToE164)(number);
        if (!normalizedNumber) {
            return false;
        }
        this.contactsCache[name.toLowerCase().trim()] = normalizedNumber;
        this.saveContacts();
        return true;
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map