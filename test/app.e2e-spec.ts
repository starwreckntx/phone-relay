
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { WsAdapter } from '@nestjs/platform-ws';

describe('Voice Telephony Agent (e2e)', () => {
  let app: INestApplication;
  let bearerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.useWebSocketAdapter(new WsAdapter(app));
    
    await app.init();

    // Get bearer token from env
    bearerToken = process.env.INTERNAL_API_BEARER || 'test-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET) should return 200 with status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('version');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('Voice Endpoints (Twilio Webhooks)', () => {
    it('/voice/incoming (POST) should return TwiML with Gather', () => {
      return request(app.getHttpServer())
        .post('/voice/incoming')
        .send({
          CallSid: 'CA1234567890test',
          From: '+12025551234',
          To: '+18005551234',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/)
        .expect((res) => {
          expect(res.text).toContain('<Response>');
          expect(res.text).toContain('<Gather');
          expect(res.text).toContain('numDigits="1"');
          expect(res.text).toContain('timeout="2"');
        });
    });

    it('/voice/accept (POST) should return TwiML with Conference and Stream', () => {
      return request(app.getHttpServer())
        .post('/voice/accept')
        .send({
          CallSid: 'CA1234567890test',
          From: '+12025551234',
          Digits: '1',
        })
        .expect(200)
        .expect('Content-Type', /text\/xml/)
        .expect((res) => {
          expect(res.text).toContain('<Response>');
          expect(res.text).toContain('<Connect>');
          expect(res.text).toContain('<Stream');
          expect(res.text).toContain('<Conference');
          expect(res.text).toContain('conf_CA1234567890test');
        });
    });
  });

  describe('Contact Management API', () => {
    it('/api/contacts (GET) should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/contacts')
        .expect(401);
    });

    it('/api/contacts (GET) should return contacts with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/contacts')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeDefined();
          expect(typeof res.body).toBe('object');
        });
    });

    it('/api/contacts (PUT) should update contacts', () => {
      const testContacts = {
        testuser: '+12025551234',
        testsupport: '+18005555678',
      };

      return request(app.getHttpServer())
        .put('/api/contacts')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(testContacts)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('testuser');
          expect(res.body.testuser).toBe('+12025551234');
        });
    });

    it('/api/contacts (PUT) should reject invalid phone numbers', () => {
      const invalidContacts = {
        testuser: 'invalid-phone',
      };

      return request(app.getHttpServer())
        .put('/api/contacts')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(invalidContacts)
        .expect(200)
        .expect((res) => {
          // Should skip invalid numbers
          expect(res.body.testuser).toBeUndefined();
        });
    });
  });

  describe('Conference API', () => {
    it('/conference/events (POST) should accept Twilio callbacks', () => {
      return request(app.getHttpServer())
        .post('/conference/events')
        .send({
          ConferenceSid: 'CF1234567890test',
          FriendlyName: 'conf_CA1234567890test',
          StatusCallbackEvent: 'conference-start',
        })
        .expect(200);
    });

    it('/api/conference/add (POST) should require authentication', () => {
      return request(app.getHttpServer())
        .post('/api/conference/add')
        .send({
          conferenceName: 'test-conference',
          targetNumber: '+12025551234',
        })
        .expect(401);
    });

    it('/api/conference/add (POST) should validate input', () => {
      return request(app.getHttpServer())
        .post('/api/conference/add')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({
          // Missing required fields
        })
        .expect(400);
    });

    it('/api/conference/forward (POST) should require authentication', () => {
      return request(app.getHttpServer())
        .post('/api/conference/forward')
        .send({
          conferenceName: 'test-conference',
          targetNumber: '+12025551234',
        })
        .expect(401);
    });

    it('/api/conference/end (POST) should require authentication', () => {
      return request(app.getHttpServer())
        .post('/api/conference/end')
        .send({
          conferenceName: 'test-conference',
        })
        .expect(401);
    });
  });

  describe('Conference State Management', () => {
    const testConferenceSid = 'CF9876543210test';
    const testConferenceName = 'conf_CAtest123';

    it('should track conference lifecycle', async () => {
      // Start conference
      await request(app.getHttpServer())
        .post('/conference/events')
        .send({
          ConferenceSid: testConferenceSid,
          FriendlyName: testConferenceName,
          StatusCallbackEvent: 'conference-start',
        })
        .expect(200);

      // Add participant
      await request(app.getHttpServer())
        .post('/conference/events')
        .send({
          ConferenceSid: testConferenceSid,
          FriendlyName: testConferenceName,
          StatusCallbackEvent: 'participant-join',
          CallSid: 'CA1111111111',
        })
        .expect(200);

      // Add another participant
      await request(app.getHttpServer())
        .post('/conference/events')
        .send({
          ConferenceSid: testConferenceSid,
          FriendlyName: testConferenceName,
          StatusCallbackEvent: 'participant-join',
          CallSid: 'CA2222222222',
        })
        .expect(200);

      // Remove participant
      await request(app.getHttpServer())
        .post('/conference/events')
        .send({
          ConferenceSid: testConferenceSid,
          FriendlyName: testConferenceName,
          StatusCallbackEvent: 'participant-leave',
          CallSid: 'CA1111111111',
        })
        .expect(200);

      // End conference
      await request(app.getHttpServer())
        .post('/conference/events')
        .send({
          ConferenceSid: testConferenceSid,
          FriendlyName: testConferenceName,
          StatusCallbackEvent: 'conference-end',
        })
        .expect(200);
    });
  });

  describe('Security', () => {
    it('should reject requests with invalid bearer token', () => {
      return request(app.getHttpServer())
        .get('/api/contacts')
        .set('Authorization', 'Bearer invalid-token-xyz')
        .expect(401);
    });

    it('should reject requests without Authorization header', () => {
      return request(app.getHttpServer())
        .get('/api/contacts')
        .expect(401);
    });

    it('should reject requests with wrong auth type', () => {
      return request(app.getHttpServer())
        .get('/api/contacts')
        .set('Authorization', 'Basic sometoken')
        .expect(401);
    });
  });

  describe('Input Validation', () => {
    it('should reject malformed JSON in conference add', () => {
      return request(app.getHttpServer())
        .post('/api/conference/add')
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should validate phone numbers in conference operations', () => {
      return request(app.getHttpServer())
        .post('/api/conference/add')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({
          conferenceName: 'test-conf',
          targetNumber: '', // Empty number
        })
        .expect(400);
    });
  });
});
