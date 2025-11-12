import { ContactsService } from './contacts.service';
import type { ContactMap } from './contacts.service';
export declare class ContactsController {
    private readonly contactsService;
    constructor(contactsService: ContactsService);
    getAllContacts(): ContactMap;
    updateContacts(contacts: ContactMap): ContactMap;
}
