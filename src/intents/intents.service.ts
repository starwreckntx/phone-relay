
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { ContactsService } from '../contacts/contacts.service';
import { extractPhoneNumber, normalizeToE164 } from '../common/utils/phone.util';

export interface ParsedIntent {
  intent: 'add' | 'forward' | 'end' | 'none';
  target_name?: string;
  target_number?: string;
  confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class IntentsService {
  private readonly llmEndpoint: string;
  private readonly llmApiKey: string;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
    private contactsService: ContactsService,
  ) {
    this.llmEndpoint = this.configService.get<string>('llm.endpoint') || '';
    this.llmApiKey = this.configService.get<string>('llm.apiKey') || '';
  }

  async parseIntent(transcript: string, callSid?: string): Promise<ParsedIntent> {
    // Try regex fast-path first
    const regexResult = this.tryRegexParsing(transcript);
    if (regexResult.confidence === 'high') {
      this.logger.log('Intent parsed via regex', {
        callSid,
        transcript,
        intent: regexResult.intent,
      });
      return regexResult;
    }

    // Fallback to LLM
    try {
      const llmResult = await this.parseLLMIntent(transcript);
      this.logger.log('Intent parsed via LLM', {
        callSid,
        transcript,
        intent: llmResult.intent,
      });
      return llmResult;
    } catch (error) {
      this.logger.error('LLM intent parsing failed', error.message, {
        callSid,
        transcript,
        error,
      });
      return { intent: 'none', confidence: 'low' };
    }
  }

  private tryRegexParsing(transcript: string): ParsedIntent {
    const text = transcript.toLowerCase().trim();

    // Pattern: "add [name/number]" or "call [name/number]" (3-way calling)
    const addPatterns = [
      /(?:add|call|dial|connect)\s+(.+)/i,
      /(?:bring\s+in|conference\s+in)\s+(.+)/i,
    ];

    for (const pattern of addPatterns) {
      const match = text.match(pattern);
      if (match) {
        const target = match[1].trim();
        return this.resolveTarget(target, 'add');
      }
    }

    // Pattern: "forward to [name/number]"
    const forwardPatterns = [
      /(?:forward|transfer)\s+(?:to|call)?\s*(.+)/i,
      /(?:send|redirect)\s+(?:to)?\s*(.+)/i,
    ];

    for (const pattern of forwardPatterns) {
      const match = text.match(pattern);
      if (match) {
        const target = match[1].trim();
        return this.resolveTarget(target, 'forward');
      }
    }

    // Pattern: "hang up" or "end call"
    const endPatterns = [
      /hang\s*up/i,
      /end\s+(?:the\s+)?call/i,
      /disconnect/i,
      /goodbye/i,
      /bye\s*bye/i,
    ];

    for (const pattern of endPatterns) {
      if (pattern.test(text)) {
        return { intent: 'end', confidence: 'high' };
      }
    }

    return { intent: 'none', confidence: 'low' };
  }

  private resolveTarget(
    target: string,
    intent: 'add' | 'forward',
  ): ParsedIntent {
    // Try to extract phone number
    const phoneNumber = extractPhoneNumber(target);
    if (phoneNumber) {
      const normalized = normalizeToE164(phoneNumber);
      if (normalized) {
        return {
          intent,
          target_number: normalized,
          confidence: 'high',
        };
      }
    }

    // Try to resolve as contact name
    const contactNumber = this.contactsService.getContact(target);
    if (contactNumber) {
      return {
        intent,
        target_name: target,
        target_number: contactNumber,
        confidence: 'high',
      };
    }

    // Return with low confidence if can't resolve
    return {
      intent,
      target_name: target,
      confidence: 'medium',
    };
  }

  private async parseLLMIntent(transcript: string): Promise<ParsedIntent> {
    const systemPrompt = `You are an intent parser for a voice telephony system. Parse user voice commands into structured intents.

Valid intents:
- "add": User wants to add a third party to the call (3-way calling). Extract target name or number.
- "forward": User wants to forward/transfer the call to someone. Extract target name or number.
- "end": User wants to end/hang up the call.
- "none": No clear intent detected.

Respond ONLY with valid JSON in this format:
{"intent": "add|forward|end|none", "target_name": "optional name", "target_number": "optional number"}`;

    const response = await fetch(this.llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.llmApiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        stream: false,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in LLM response');
    }

    const parsed = JSON.parse(content);

    // Normalize the target number if present
    if (parsed.target_number) {
      const normalized = normalizeToE164(parsed.target_number);
      if (normalized) {
        parsed.target_number = normalized;
      }
    }

    // Try to resolve target_name to number if we have it
    if (parsed.target_name && !parsed.target_number) {
      const contactNumber = this.contactsService.getContact(parsed.target_name);
      if (contactNumber) {
        parsed.target_number = contactNumber;
      }
    }

    return {
      ...parsed,
      confidence: 'medium',
    };
  }
}
