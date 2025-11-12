"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeToE164 = normalizeToE164;
exports.extractPhoneNumber = extractPhoneNumber;
const libphonenumber_js_1 = require("libphonenumber-js");
function normalizeToE164(phoneNumber, defaultCountry = 'US') {
    try {
        const parsed = (0, libphonenumber_js_1.parsePhoneNumber)(phoneNumber, defaultCountry);
        if (parsed && parsed.isValid()) {
            return parsed.format('E.164');
        }
        return null;
    }
    catch (error) {
        return null;
    }
}
function extractPhoneNumber(input) {
    const cleaned = input.replace(/[\s\-\(\)\.]/g, '');
    const patterns = [
        /\+?\d{10,15}/,
        /\d{10}/,
    ];
    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            return match[0];
        }
    }
    return null;
}
//# sourceMappingURL=phone.util.js.map