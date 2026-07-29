// ============================================================
// voiceOtpApi.integration.test.ts — integration tests for
// Voice OTP API endpoints using supertest against the running server.
//
// Prerequisites: server.cjs must be running on localhost:3000
// Run with: npx vitest run src/services/voiceOtpApi.integration.test.ts
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// ============================================================
// TEST CONFIG
// ============================================================
const BASE_URL = 'http://localhost:3000';
const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };

// Shared token + created config ID for cleanup
let authToken = '';
let createdConfigId: number | null = null;

// ============================================================
// SETUP: Login once and share token across all tests
// ============================================================
beforeAll(async () => {
  const res = await request(BASE_URL)
    .post('/api/auth/login')
    .send(ADMIN_CREDENTIALS)
    .expect(200);

  authToken = res.body.token;
  expect(authToken).toBeTruthy();
  console.log('[integration] logged in as admin, token acquired');
}, 15000);

// ============================================================
// TEARDOWN: Clean up any test-created config
// ============================================================
afterAll(async () => {
  if (createdConfigId && authToken) {
    try {
      await request(BASE_URL)
        .delete(`/api/voice-otp/configs/${createdConfigId}`)
        .set('Authorization', `Bearer ${authToken}`);
      console.log(`[integration] cleaned up test config id=${createdConfigId}`);
    } catch {
      // Best-effort cleanup — ignore if already deleted by test
    }
  }
}, 10000);

// ============================================================
// Helper: auth header
// ============================================================
function auth() {
  return { Authorization: `Bearer ${authToken}` };
}

// ============================================================
// 1. CONFIGS CRUD
// ============================================================
describe('Voice OTP API — /api/voice-otp/configs', () => {
  // --- GET all configs ---
  it('GET /configs returns success with data array', async () => {
    const res = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .set(auth())
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Configs should have expected fields
    if (res.body.data.length > 0) {
      const cfg = res.body.data[0];
      expect(cfg).toHaveProperty('id');
      expect(cfg).toHaveProperty('language');
      expect(cfg).toHaveProperty('country_prefix');
      expect(cfg).toHaveProperty('primary_language_code');
    }
  });

  // --- GET without token should fail ---
  it('GET /configs without token returns 401', async () => {
    const res = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .expect(401);

    expect(res.body.error).toBeTruthy();
  });

  // --- POST create new config (valid) ---
  it('POST /configs creates a new country group', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/configs')
      .set(auth())
      .send({
        language: 'Test Group Integration',
        country_prefix: '+999',
        primary_language_code: 'en',
        secondary_language_code: '',
        retry_count: 4,
        play_count: 3,
        is_active: true,
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.language).toBe('Test Group Integration');
    expect(res.body.data.country_prefix).toBe('+999');
    expect(res.body.data.primary_language_code).toBe('en');
    expect(res.body.data.retry_count).toBe(4);
    expect(res.body.data.play_count).toBe(3);

    createdConfigId = res.body.data.id;
  });

  // --- POST with missing required fields ---
  it('POST /configs fails when language is missing', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/configs')
      .set(auth())
      .send({
        country_prefix: '+1',
        primary_language_code: 'en',
      })
      .expect(400);

    expect(res.body.error).toMatch(/language/);
  });

  it('POST /configs fails when country_prefix is missing', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/configs')
      .set(auth())
      .send({
        language: 'No Prefix',
        primary_language_code: 'en',
      })
      .expect(400);

    expect(res.body.error).toBeTruthy();
  });

  // --- POST with invalid retry_count ---
  it('POST /configs rejects retry_count outside 1-4', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/configs')
      .set(auth())
      .send({
        language: 'Bad Retry',
        country_prefix: '+1',
        primary_language_code: 'en',
        retry_count: 99,
      })
      .expect(400);

    expect(res.body.error).toMatch(/retry_count/);
  });

  // --- POST with invalid play_count ---
  it('POST /configs rejects play_count outside 1-3', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/configs')
      .set(auth())
      .send({
        language: 'Bad Play',
        country_prefix: '+1',
        primary_language_code: 'en',
        play_count: 0,
      })
      .expect(400);

    expect(res.body.error).toMatch(/play_count/);
  });

  // --- PUT update existing config ---
  it('PUT /configs/:id updates an existing group', async () => {
    // Requires createdConfigId from the POST test above
    expect(createdConfigId).toBeTruthy();

    const res = await request(BASE_URL)
      .put(`/api/voice-otp/configs/${createdConfigId}`)
      .set(auth())
      .send({
        language: 'Test Group Integration UPDATED',
        retry_count: 2,
        play_count: 1,
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify the update took effect
    const getRes = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .set(auth())
      .expect(200);

    const updated = getRes.body.data.find((c: any) => c.id === createdConfigId);
    expect(updated).toBeTruthy();
    expect(updated.language).toBe('Test Group Integration UPDATED');
    expect(updated.retry_count).toBe(2);
    expect(updated.play_count).toBe(1);
  });

  // --- PUT with no fields returns success (idempotent) ---
  it('PUT /configs/:id with no fields returns success', async () => {
    expect(createdConfigId).toBeTruthy();

    const res = await request(BASE_URL)
      .put(`/api/voice-otp/configs/${createdConfigId}`)
      .set(auth())
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  // --- PUT with secondary_language_code ---
  it('PUT /configs/:id updates secondary_language_code', async () => {
    expect(createdConfigId).toBeTruthy();

    const res = await request(BASE_URL)
      .put(`/api/voice-otp/configs/${createdConfigId}`)
      .set(auth())
      .send({
        secondary_language_code: 'bn',
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    const getRes = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .set(auth())
      .expect(200);

    const updated = getRes.body.data.find((c: any) => c.id === createdConfigId);
    expect(updated.secondary_language_code).toBe('bn');
  });

  // --- PUT toggle is_active ---
  it('PUT /configs/:id toggles is_active', async () => {
    expect(createdConfigId).toBeTruthy();

    // Set to inactive
    await request(BASE_URL)
      .put(`/api/voice-otp/configs/${createdConfigId}`)
      .set(auth())
      .send({ is_active: false })
      .expect(200);

    const getRes1 = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .set(auth())
      .expect(200);

    const inactive = getRes1.body.data.find((c: any) => c.id === createdConfigId);
    expect(inactive.is_active).toBe(false);

    // Set back to active
    await request(BASE_URL)
      .put(`/api/voice-otp/configs/${createdConfigId}`)
      .set(auth())
      .send({ is_active: true })
      .expect(200);
  });

  // --- DELETE config ---
  it('DELETE /configs/:id removes a group', async () => {
    expect(createdConfigId).toBeTruthy();

    const res = await request(BASE_URL)
      .delete(`/api/voice-otp/configs/${createdConfigId}`)
      .set(auth())
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify it's gone
    const getRes = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .set(auth())
      .expect(200);

    const stillExists = getRes.body.data.find((c: any) => c.id === createdConfigId);
    expect(stillExists).toBeUndefined();

    createdConfigId = null; // Don't try to clean up again
  });

  // --- DELETE non-existent returns 404 ---
  it('DELETE /configs/:id on non-existent returns 404', async () => {
    const res = await request(BASE_URL)
      .delete('/api/voice-otp/configs/99999')
      .set(auth())
      .expect(404);

    expect(res.body.error).toBeTruthy();
  });
});

// ============================================================
// 2. GLOBAL SIP SETTINGS
// ============================================================
describe('Voice OTP API — /api/voice-otp/global-sip', () => {
  // --- GET global-sip ---
  it('GET /global-sip returns settings object', async () => {
    const res = await request(BASE_URL)
      .get('/api/voice-otp/global-sip')
      .set(auth())
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    // After migration, platform_settings should have voice_otp_* keys
    expect(res.body.data).toHaveProperty('voice_otp_sip_host');
    expect(res.body.data).toHaveProperty('voice_otp_sip_port');
    expect(res.body.data).toHaveProperty('voice_otp_audio_codec');
    expect(res.body.data).toHaveProperty('voice_otp_is_e164');
  });

  // --- GET without token fails ---
  it('GET /global-sip without token returns 401', async () => {
    const res = await request(BASE_URL)
      .get('/api/voice-otp/global-sip')
      .expect(401);

    expect(res.body.error).toBeTruthy();
  });

  // --- PUT updates global SIP settings ---
  it('PUT /global-sip updates settings', async () => {
    const res = await request(BASE_URL)
      .put('/api/voice-otp/global-sip')
      .set(auth())
      .send({
        voice_otp_sip_host: 'sip.test-provider.com',
        voice_otp_sip_port: '5060',
        voice_otp_sip_username: 'testuser',
        voice_otp_sip_password: 'testpass',
        voice_otp_caller_id: '+1234567890',
        voice_otp_is_e164: 'true',
        voice_otp_audio_codec: 'g711',
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify the update took effect
    const getRes = await request(BASE_URL)
      .get('/api/voice-otp/global-sip')
      .set(auth())
      .expect(200);

    expect(getRes.body.data.voice_otp_sip_host).toBe('sip.test-provider.com');
    expect(getRes.body.data.voice_otp_caller_id).toBe('+1234567890');
    expect(getRes.body.data.voice_otp_audio_codec).toBe('g711');
    expect(getRes.body.data.voice_otp_is_e164).toBe('true');
  });

  // --- PUT partial update (only some fields) ---
  it('PUT /global-sip partial update changes only sent fields', async () => {
    // First, get current state
    const before = await request(BASE_URL)
      .get('/api/voice-otp/global-sip')
      .set(auth())
      .expect(200);

    const originalHost = before.body.data.voice_otp_sip_host;

    // Update only audio codec
    await request(BASE_URL)
      .put('/api/voice-otp/global-sip')
      .set(auth())
      .send({
        voice_otp_audio_codec: 'g729',
      })
      .expect(200);

    const after = await request(BASE_URL)
      .get('/api/voice-otp/global-sip')
      .set(auth())
      .expect(200);

    expect(after.body.data.voice_otp_audio_codec).toBe('g729');
    // Host should be unchanged by partial update
    expect(after.body.data.voice_otp_sip_host).toBe(originalHost);

    // Restore original codec
    await request(BASE_URL)
      .put('/api/voice-otp/global-sip')
      .set(auth())
      .send({
        voice_otp_audio_codec: 'g711',
      })
      .expect(200);
  });

  // --- PUT all 3 codec options ---
  for (const codec of ['g711', 'g729', 'gsm']) {
    it(`PUT /global-sip sets audio_codec to ${codec}`, async () => {
      const res = await request(BASE_URL)
        .put('/api/voice-otp/global-sip')
        .set(auth())
        .send({ voice_otp_audio_codec: codec })
        .expect(200);

      expect(res.body.success).toBe(true);

      const getRes = await request(BASE_URL)
        .get('/api/voice-otp/global-sip')
        .set(auth())
        .expect(200);

      expect(getRes.body.data.voice_otp_audio_codec).toBe(codec);
    });
  }

  // --- PUT E.164 toggle ---
  it('PUT /global-sip toggles is_e164 between true/false', async () => {
    // Set to false
    await request(BASE_URL)
      .put('/api/voice-otp/global-sip')
      .set(auth())
      .send({ voice_otp_is_e164: 'false' })
      .expect(200);

    const resFalse = await request(BASE_URL)
      .get('/api/voice-otp/global-sip')
      .set(auth())
      .expect(200);

    expect(resFalse.body.data.voice_otp_is_e164).toBe('false');

    // Set back to true (restore default)
    await request(BASE_URL)
      .put('/api/voice-otp/global-sip')
      .set(auth())
      .send({ voice_otp_is_e164: 'true' })
      .expect(200);
  });
});

// ============================================================
// 3. SEED DEFAULTS
// ============================================================
describe('Voice OTP API — /api/voice-otp/seed-defaults', () => {
  it('POST /seed-defaults with empty groups returns inserted=0', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/seed-defaults')
      .set(auth())
      .send({ groups: [] })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.inserted).toBe(0);
  });

  it('POST /seed-defaults without groups array still succeeds', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/seed-defaults')
      .set(auth())
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.inserted).toBe(0);
  });
});

// ============================================================
// 4. CALL LOGS
// ============================================================
describe('Voice OTP API — /api/voice-otp/logs', () => {
  it('POST /logs returns success with data array', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/logs')
      .set(auth())
      .send({ limit: 10 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /logs with status filter returns only matching records', async () => {
    // First, insert a test log with a known status so the filter has something to match
    // Use /api/voice-otp/test which creates a completed synthetic call log
    await request(BASE_URL)
      .post('/api/voice-otp/test')
      .set(auth())
      .send({ destination: '+12345678901', language: 'en-US' })
      .expect(200);

    const res = await request(BASE_URL)
      .post('/api/voice-otp/logs')
      .set(auth())
      .send({ status: 'completed', limit: 5 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    // All returned logs should have status 'completed'
    for (const log of res.body.data) {
      expect(log.status).toBe('completed');
    }
  });

  it('POST /logs with language filter works', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/logs')
      .set(auth())
      .send({ language: 'en', limit: 5 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /logs without token returns 401', async () => {
    await request(BASE_URL)
      .post('/api/voice-otp/logs')
      .send({})
      .expect(401);
  });
});

// ============================================================
// 5. LANGUAGES LIST
// ============================================================
describe('Voice OTP API — /api/voice-otp/languages', () => {
  it('GET /languages returns language list as array of strings', async () => {
    const res = await request(BASE_URL)
      .get('/api/voice-otp/languages')
      .set(auth())
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Languages are code strings like "en-US", "en-GB", "es-ES"
    expect(typeof res.body.data[0]).toBe('string');
    expect(res.body.data).toContain('en-US');
    expect(res.body.data).toContain('es-ES');
    expect(res.body.data).toContain('ar-SA');
  });
});

// ============================================================
// 6. CONFIGS CRUD — complete round-trip (create → update → delete)
// ============================================================
describe('Voice OTP API — full round-trip', () => {
  let roundTripId: number | null = null;

  afterAll(async () => {
    if (roundTripId && authToken) {
      try {
        await request(BASE_URL)
          .delete(`/api/voice-otp/configs/${roundTripId}`)
          .set(auth());
      } catch { /* ignore */ }
    }
  });

  it('CREATE: creates a French country group with all fields', async () => {
    const res = await request(BASE_URL)
      .post('/api/voice-otp/configs')
      .set(auth())
      .send({
        language: 'France Round-Trip',
        country_prefix: '+33',
        primary_language_code: 'fr',
        secondary_language_code: 'en',
        retry_count: 3,
        play_count: 2,
        is_active: true,
      })
      .expect(200);

    roundTripId = res.body.data.id;
    expect(res.body.data.language).toBe('France Round-Trip');
  });

  it('READ: fetches the created group with all fields intact', async () => {
    expect(roundTripId).toBeTruthy();

    const res = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .set(auth())
      .expect(200);

    const cfg = res.body.data.find((c: any) => c.id === roundTripId);
    expect(cfg).toBeTruthy();
    expect(cfg.language).toBe('France Round-Trip');
    expect(cfg.country_prefix).toBe('+33');
    expect(cfg.primary_language_code).toBe('fr');
    expect(cfg.secondary_language_code).toBe('en');
    expect(cfg.retry_count).toBe(3);
    expect(cfg.play_count).toBe(2);
  });

  it('UPDATE: changes retry_count, play_count, and secondary language', async () => {
    expect(roundTripId).toBeTruthy();

    await request(BASE_URL)
      .put(`/api/voice-otp/configs/${roundTripId}`)
      .set(auth())
      .send({
        retry_count: 1,
        play_count: 3,
        secondary_language_code: 'ar',
      })
      .expect(200);

    const res = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .set(auth())
      .expect(200);

    const cfg = res.body.data.find((c: any) => c.id === roundTripId);
    expect(cfg.retry_count).toBe(1);
    expect(cfg.play_count).toBe(3);
    expect(cfg.secondary_language_code).toBe('ar');
  });

  it('DELETE: removes the group and confirms it is gone', async () => {
    expect(roundTripId).toBeTruthy();

    await request(BASE_URL)
      .delete(`/api/voice-otp/configs/${roundTripId}`)
      .set(auth())
      .expect(200);

    const res = await request(BASE_URL)
      .get('/api/voice-otp/configs')
      .set(auth())
      .expect(200);

    const cfg = res.body.data.find((c: any) => c.id === roundTripId);
    expect(cfg).toBeUndefined();

    roundTripId = null;
  });
});
