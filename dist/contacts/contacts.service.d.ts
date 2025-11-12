import { LoggerService } from '../common/logger/logger.service';
export interface ContactMap {
    [name: string]: string;
}
export declare class ContactsService {
    private logger;
    private readonly contactsFilePath;
    private contactsCache;
    constructor(logger: LoggerService);
    private loadContacts;
    private saveContacts;
    getAllContacts(): ContactMap;
    getContact(name: string): string | null;
    updateContacts(contacts: ContactMap): ContactMap;
    addContact(name: string, number: string): boolean;
}
