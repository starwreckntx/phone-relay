
import { Injectable } from '@nestjs/common';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { normalizeToE164 } from '../common/utils/phone.util';
import { LoggerService } from '../common/logger/logger.service';

export interface ContactMap {
  [name: string]: string; // name -> E.164 number
}

@Injectable()
export class ContactsService {
  private readonly contactsFilePath: string;
  private contactsCache: ContactMap = {};

  constructor(private logger: LoggerService) {
    this.contactsFilePath = join(process.cwd(), 'contacts.json');
    this.loadContacts();
  }

  private loadContacts(): void {
    try {
      if (existsSync(this.contactsFilePath)) {
        const data = readFileSync(this.contactsFilePath, 'utf-8');
        this.contactsCache = JSON.parse(data);
        this.logger.log('Contacts loaded successfully', {
          count: Object.keys(this.contactsCache).length,
        });
      } else {
        this.contactsCache = {};
        this.saveContacts();
        this.logger.log('Created new contacts file');
      }
    } catch (error) {
      this.logger.error('Failed to load contacts', error.message, { error });
      this.contactsCache = {};
    }
  }

  private saveContacts(): void {
    try {
      writeFileSync(
        this.contactsFilePath,
        JSON.stringify(this.contactsCache, null, 2),
        'utf-8',
      );
      this.logger.log('Contacts saved successfully');
    } catch (error) {
      this.logger.error('Failed to save contacts', error.message, { error });
    }
  }

  getAllContacts(): ContactMap {
    return { ...this.contactsCache };
  }

  getContact(name: string): string | null {
    const normalizedName = name.toLowerCase().trim();
    return this.contactsCache[normalizedName] || null;
  }

  updateContacts(contacts: ContactMap): ContactMap {
    // Normalize all numbers to E.164
    const normalized: ContactMap = {};
    for (const [name, number] of Object.entries(contacts)) {
      const normalizedNumber = normalizeToE164(number);
      if (normalizedNumber) {
        normalized[name.toLowerCase().trim()] = normalizedNumber;
      } else {
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

  addContact(name: string, number: string): boolean {
    const normalizedNumber = normalizeToE164(number);
    if (!normalizedNumber) {
      return false;
    }

    this.contactsCache[name.toLowerCase().trim()] = normalizedNumber;
    this.saveContacts();
    return true;
  }
}
