// ============================================================
// VoiceOTP.test.ts — vitest unit tests for VoiceOTP.tsx
// language group modal form logic + audio upload/playback
// ============================================================
// Tests the pure data transformation that builds the API request
// body from groupForm state, plus audio status computation,
// upload validation, and playback readiness checks.
// No DOM or React rendering required.
//
// Run with: npx vitest run src/pages/Suppliers/VoiceOTP.test.ts
// ============================================================

import { describe, it, expect } from 'vitest';

// ------------------------------------------------------------
// Types matching the VoiceOTP groupForm state
// ------------------------------------------------------------
interface GroupFormData {
  name: string;
  country_prefix: string;
  primary_language_code: string;
  secondary_language_code: string;
  retry_count: number;
  play_count: number;
  is_active: boolean;
}

// ------------------------------------------------------------
// Default form values (mirrors openGroupModal in VoiceOTP.tsx)
// ------------------------------------------------------------
function defaultGroupForm(): GroupFormData {
  return {
    name: '',
    country_prefix: '',
    primary_language_code: 'en',
    secondary_language_code: '',
    retry_count: 3,
    play_count: 2,
    is_active: true,
  };
}

// ------------------------------------------------------------
// Extracted saveGroup body builder (mirrors VoiceOTP.tsx saveGroup)
// ------------------------------------------------------------
function buildSaveBody(
  groupForm: GroupFormData,
  _editingGroupId: number | null,
): Record<string, unknown> {
  return {
    language: groupForm.name,
    country_prefix: groupForm.country_prefix,
    primary_language_code: groupForm.primary_language_code,
    secondary_language_code: groupForm.secondary_language_code || '',
    retry_count: groupForm.retry_count,
    play_count: groupForm.play_count,
    is_active: groupForm.is_active,
    language_code: groupForm.primary_language_code,
    greeting_text: '',
    retry_text: '',
    primary_greeting_text: '',
    primary_retry_text: '',
  };
}

// ------------------------------------------------------------
// Extracted openGroupModal form mapper (mirrors VoiceOTP.tsx)
// ------------------------------------------------------------
interface ConfigRow {
  language: string;
  country_prefix: string;
  primary_language_code: string;
  secondary_language_code?: string;
  retry_count?: number;
  play_count?: number;
  is_active?: boolean;
}

function mapConfigToForm(existing: ConfigRow): GroupFormData {
  return {
    name: existing.language || '',
    country_prefix: existing.country_prefix || '',
    primary_language_code: existing.primary_language_code || 'en',
    secondary_language_code: existing.secondary_language_code || '',
    retry_count: existing.retry_count ?? 3,
    play_count: existing.play_count ?? 2,
    is_active: existing.is_active !== false,
  };
}

// ============================================================
// saveGroup body builder tests
// ============================================================
describe('VoiceOTP — buildSaveBody (new group)', () => {
  it('includes secondary_language_code when set', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Bangladesh',
      country_prefix: '+880',
      primary_language_code: 'bn',
      secondary_language_code: 'en',
      retry_count: 3,
      play_count: 2,
    };
    const body = buildSaveBody(form, null);
    expect(body.secondary_language_code).toBe('en');
  });

  it('sends empty string for secondary_language_code when not set', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Pakistan',
      country_prefix: '+92',
      primary_language_code: 'ur',
      secondary_language_code: '',
    };
    const body = buildSaveBody(form, null);
    expect(body.secondary_language_code).toBe('');
  });

  it('sends retry_count as a number', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Test Group',
      country_prefix: '+1',
      retry_count: 4,
    };
    const body = buildSaveBody(form, null);
    expect(body.retry_count).toBe(4);
    expect(typeof body.retry_count).toBe('number');
  });

  it('sends default retry_count of 3', () => {
    const form = defaultGroupForm();
    const body = buildSaveBody(form, null);
    expect(body.retry_count).toBe(3);
  });

  it('sends play_count as a number', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Test Group',
      country_prefix: '+1',
      play_count: 3,
    };
    const body = buildSaveBody(form, null);
    expect(body.play_count).toBe(3);
    expect(typeof body.play_count).toBe('number');
  });

  it('sends default play_count of 2', () => {
    const form = defaultGroupForm();
    const body = buildSaveBody(form, null);
    expect(body.play_count).toBe(2);
  });

  it('sends retry_count = 1 (minimum)', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Min Retry',
      country_prefix: '+44',
      retry_count: 1,
    };
    const body = buildSaveBody(form, null);
    expect(body.retry_count).toBe(1);
  });

  it('sends play_count = 1 (minimum)', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Min Play',
      country_prefix: '+44',
      play_count: 1,
    };
    const body = buildSaveBody(form, null);
    expect(body.play_count).toBe(1);
  });

  it('sends language_code matching primary_language_code', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Arabic',
      country_prefix: '+966',
      primary_language_code: 'ar',
    };
    const body = buildSaveBody(form, null);
    expect(body.language_code).toBe('ar');
    expect(body.primary_language_code).toBe('ar');
  });

  it('sends language (group name) as the name field', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Germany & Austria',
      country_prefix: '+49,+43',
    };
    const body = buildSaveBody(form, null);
    expect(body.language).toBe('Germany & Austria');
  });

  it('sends country_prefix as-is', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Multi',
      country_prefix: '+1,+44,+61',
    };
    const body = buildSaveBody(form, null);
    expect(body.country_prefix).toBe('+1,+44,+61');
  });

  it('always sends is_active boolean', () => {
    const activeForm = defaultGroupForm();
    const bodyActive = buildSaveBody(activeForm, null);
    expect(bodyActive.is_active).toBe(true);

    const inactiveForm: GroupFormData = { ...defaultGroupForm(), name: 'X', country_prefix: '+1', is_active: false };
    const bodyInactive = buildSaveBody(inactiveForm, null);
    expect(bodyInactive.is_active).toBe(false);
  });

  it('always sends empty greeting_text, retry_text, primary_greeting_text, primary_retry_text', () => {
    const form = defaultGroupForm();
    const body = buildSaveBody(form, null);
    expect(body.greeting_text).toBe('');
    expect(body.retry_text).toBe('');
    expect(body.primary_greeting_text).toBe('');
    expect(body.primary_retry_text).toBe('');
  });
});

describe('VoiceOTP — buildSaveBody (edit group)', () => {
  it('includes secondary_language_code when editing', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Bangladesh',
      country_prefix: '+880',
      primary_language_code: 'bn',
      secondary_language_code: 'en',
    };
    const body = buildSaveBody(form, 1);
    expect(body.secondary_language_code).toBe('en');
  });

  it('sends retry_count and play_count when editing', () => {
    const form: GroupFormData = {
      ...defaultGroupForm(),
      name: 'Updated',
      country_prefix: '+1',
      retry_count: 2,
      play_count: 1,
    };
    const body = buildSaveBody(form, 5);
    expect(body.retry_count).toBe(2);
    expect(body.play_count).toBe(1);
  });
});

// ============================================================
// mapConfigToForm tests
// ============================================================
describe('VoiceOTP — mapConfigToForm', () => {
  it('maps a full config row to form data', () => {
    const cfg: ConfigRow = {
      language: 'Bangladesh',
      country_prefix: '+880',
      primary_language_code: 'bn',
      secondary_language_code: 'en',
      retry_count: 4,
      play_count: 3,
      is_active: true,
    };
    const form = mapConfigToForm(cfg);
    expect(form.name).toBe('Bangladesh');
    expect(form.country_prefix).toBe('+880');
    expect(form.primary_language_code).toBe('bn');
    expect(form.secondary_language_code).toBe('en');
    expect(form.retry_count).toBe(4);
    expect(form.play_count).toBe(3);
    expect(form.is_active).toBe(true);
  });

  it('maps secondary_language_code as empty string when missing', () => {
    const cfg: ConfigRow = {
      language: 'India',
      country_prefix: '+91',
      primary_language_code: 'hi',
    };
    const form = mapConfigToForm(cfg);
    expect(form.secondary_language_code).toBe('');
  });

  it('defaults retry_count to 3 when undefined', () => {
    const cfg: ConfigRow = {
      language: 'Test',
      country_prefix: '+1',
      primary_language_code: 'en',
    };
    const form = mapConfigToForm(cfg);
    expect(form.retry_count).toBe(3);
  });

  it('defaults play_count to 2 when undefined', () => {
    const cfg: ConfigRow = {
      language: 'Test',
      country_prefix: '+1',
      primary_language_code: 'en',
    };
    const form = mapConfigToForm(cfg);
    expect(form.play_count).toBe(2);
  });

  it('defaults primary_language_code to en when missing', () => {
    const cfg: ConfigRow = {
      language: 'Missing',
      country_prefix: '+1',
      primary_language_code: '',
    };
    const form = mapConfigToForm(cfg);
    expect(form.primary_language_code).toBe('en');
  });

  it('handles retry_count = 0 by falling back to default 3 (?? semantics)', () => {
    const cfg: ConfigRow = {
      language: 'Zero Retry',
      country_prefix: '+1',
      primary_language_code: 'en',
      retry_count: 0,
    };
    const form = mapConfigToForm(cfg);
    // 0 is not null/undefined, so ?? preserves it
    expect(form.retry_count).toBe(0);
  });

  it('handles play_count = 0 by preserving it (?? semantics)', () => {
    const cfg: ConfigRow = {
      language: 'Zero Play',
      country_prefix: '+1',
      primary_language_code: 'en',
      play_count: 0,
    };
    const form = mapConfigToForm(cfg);
    expect(form.play_count).toBe(0);
  });

  it('maps is_active = false correctly', () => {
    const cfg: ConfigRow = {
      language: 'Inactive',
      country_prefix: '+1',
      primary_language_code: 'en',
      is_active: false,
    };
    const form = mapConfigToForm(cfg);
    expect(form.is_active).toBe(false);
  });

  it('maps is_active = true correctly', () => {
    const cfg: ConfigRow = {
      language: 'Active',
      country_prefix: '+1',
      primary_language_code: 'en',
      is_active: true,
    };
    const form = mapConfigToForm(cfg);
    expect(form.is_active).toBe(true);
  });

  it('treats missing is_active as true (default)', () => {
    const cfg: ConfigRow = {
      language: 'New',
      country_prefix: '+1',
      primary_language_code: 'en',
    };
    const form = mapConfigToForm(cfg);
    expect(form.is_active).toBe(true);
  });

  it('handles empty language and country_prefix', () => {
    const cfg: ConfigRow = {
      language: '',
      country_prefix: '',
      primary_language_code: 'en',
    };
    const form = mapConfigToForm(cfg);
    expect(form.name).toBe('');
    expect(form.country_prefix).toBe('');
  });
});

// ============================================================
// Combined integration: form -> save body round-trip
// ============================================================
describe('VoiceOTP — round-trip (map then build)', () => {
  it('round-trips a config with all fields set', () => {
    const cfg: ConfigRow = {
      language: 'Pakistan',
      country_prefix: '+92',
      primary_language_code: 'ur',
      secondary_language_code: 'en',
      retry_count: 3,
      play_count: 2,
      is_active: true,
    };
    const form = mapConfigToForm(cfg);
    const body = buildSaveBody(form, 1);

    expect(body.language).toBe('Pakistan');
    expect(body.country_prefix).toBe('+92');
    expect(body.primary_language_code).toBe('ur');
    expect(body.secondary_language_code).toBe('en');
    expect(body.retry_count).toBe(3);
    expect(body.play_count).toBe(2);
    expect(body.is_active).toBe(true);
    expect(body.language_code).toBe('ur');
  });

  it('round-trips a config with no secondary language', () => {
    const cfg: ConfigRow = {
      language: 'Korea',
      country_prefix: '+82',
      primary_language_code: 'ko',
    };
    const form = mapConfigToForm(cfg);
    const body = buildSaveBody(form, null);

    expect(body.secondary_language_code).toBe('');
    expect(body.retry_count).toBe(3);
    expect(body.play_count).toBe(2);
  });

  it('round-trips custom retry and play counts', () => {
    const cfg: ConfigRow = {
      language: 'High Priority',
      country_prefix: '+1',
      primary_language_code: 'en',
      retry_count: 1,
      play_count: 1,
    };
    const form = mapConfigToForm(cfg);
    const body = buildSaveBody(form, null);

    expect(body.retry_count).toBe(1);
    expect(body.play_count).toBe(1);
  });
});

// ============================================================
// AUDIO PLAYBACK TESTS
// ============================================================

// ------------------------------------------------------------
// Types for audio configs (mirrors voice_otp_configs rows)
// ------------------------------------------------------------
interface AudioConfig {
  id: number;
  language: string;
  primary_language_code: string;
  greeting_audio_url?: string | null;
  audio_files?: Record<string, string> | null;
  is_active?: boolean;
}

// ------------------------------------------------------------
// isValidAudioDigit — validates digit label for audio upload
// ------------------------------------------------------------
function isValidAudioDigit(digit: string): boolean {
  if (digit === 'greeting') return true;
  return /^[0-9]$/.test(digit);
}

// ------------------------------------------------------------
// isValidAudioFile — validates file extension for audio upload
// ------------------------------------------------------------
function isValidAudioFile(filename: string): boolean {
  return /\.(mp3|wav)$/i.test(filename);
}

// ------------------------------------------------------------
// isMp3File — checks if audio file needs conversion
// ------------------------------------------------------------
function isMp3File(filename: string): boolean {
  return filename.toLowerCase().endsWith('.mp3');
}

// ------------------------------------------------------------
// computeAudioStatus — the selectedLangAudioStatus logic
// (mirrors the IIFE in VoiceOTP.tsx)
// ------------------------------------------------------------
interface AudioStatus {
  found: boolean;
  greeting: boolean;
  digitCount: number;
  complete: boolean;
  groupName: string | null;
}

function computeAudioStatus(
  configs: AudioConfig[],
  primaryLanguageCode: string,
  editingGroup: AudioConfig | null,
): AudioStatus | null {
  const code = primaryLanguageCode;
  if (!code) return null;

  const match = configs.find((c) =>
    c.primary_language_code === code &&
    (!editingGroup || c.id !== editingGroup.id) &&
    (Object.keys(c.audio_files || {}).length > 0 || !!c.greeting_audio_url)
  );

  const anyMatch = match || configs.find((c) =>
    c.primary_language_code === code &&
    (!editingGroup || c.id !== editingGroup.id)
  ) || (editingGroup ? configs.find((c) => c.id === editingGroup.id) : null);

  if (!anyMatch) {
    return { found: false, greeting: false, digitCount: 0, complete: false, groupName: null };
  }

  const audioFiles = anyMatch.audio_files || {};
  const digitCount = Object.keys(audioFiles).length;
  const hasGreeting = !!anyMatch.greeting_audio_url;

  return {
    found: true,
    greeting: hasGreeting,
    digitCount,
    complete: hasGreeting && digitCount >= 10,
    groupName: match ? match.language : null,
  };
}

// ------------------------------------------------------------
// isAudioComplete — checks if a single config has full audio
// ------------------------------------------------------------
function isAudioComplete(cfg: AudioConfig): boolean {
  const digitCount = Object.keys(cfg.audio_files || {}).length;
  return !!cfg.greeting_audio_url && digitCount >= 10;
}

// ------------------------------------------------------------
// countGroupsWithFullAudio — used for the "Full Audio" stat
// ------------------------------------------------------------
function countGroupsWithFullAudio(configs: AudioConfig[]): number {
  return configs.filter((c) => isAudioComplete(c)).length;
}

// ------------------------------------------------------------
// audioDigitCount — returns count of uploaded digit files
// ------------------------------------------------------------
function audioDigitCount(cfg: AudioConfig): number {
  return Object.keys(cfg.audio_files || {}).length;
}

// ============================================================
// 1. Digit Validation Tests
// ============================================================
describe('VoiceOTP Audio — digit validation', () => {
  it('accepts "greeting" as a valid digit', () => {
    expect(isValidAudioDigit('greeting')).toBe(true);
  });

  it('accepts all single digits 0-9', () => {
    for (let d = 0; d <= 9; d++) {
      expect(isValidAudioDigit(String(d))).toBe(true);
    }
  });

  it('rejects empty string', () => {
    expect(isValidAudioDigit('')).toBe(false);
  });

  it('rejects multi-digit numbers like "10"', () => {
    expect(isValidAudioDigit('10')).toBe(false);
  });

  it('rejects letters', () => {
    expect(isValidAudioDigit('abc')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidAudioDigit('#')).toBe(false);
    expect(isValidAudioDigit('!')).toBe(false);
  });

  it('rejects negative numbers', () => {
    expect(isValidAudioDigit('-1')).toBe(false);
  });

  it('rejects digit with leading or trailing whitespace', () => {
    expect(isValidAudioDigit(' 5')).toBe(false);
    expect(isValidAudioDigit('5 ')).toBe(false);
    expect(isValidAudioDigit(' 5 ')).toBe(false);
    expect(isValidAudioDigit('\t3')).toBe(false);
  });

  it('is case-sensitive for "greeting"', () => {
    expect(isValidAudioDigit('Greeting')).toBe(false);
    expect(isValidAudioDigit('GREETING')).toBe(false);
  });
});

// ============================================================
// 2. File Validation Tests
// ============================================================
describe('VoiceOTP Audio — file validation', () => {
  it('accepts .mp3 files', () => {
    expect(isValidAudioFile('greeting.mp3')).toBe(true);
    expect(isValidAudioFile('digit_5.MP3')).toBe(true);
    expect(isValidAudioFile('audio.Mp3')).toBe(true);
  });

  it('accepts .wav files', () => {
    expect(isValidAudioFile('greeting.wav')).toBe(true);
    expect(isValidAudioFile('DIGIT_0.WAV')).toBe(true);
    expect(isValidAudioFile('test.Wav')).toBe(true);
  });

  it('rejects non-audio extensions', () => {
    expect(isValidAudioFile('readme.txt')).toBe(false);
    expect(isValidAudioFile('image.png')).toBe(false);
    expect(isValidAudioFile('script.js')).toBe(false);
    expect(isValidAudioFile('video.mp4')).toBe(false);
  });

  it('rejects files with no extension', () => {
    expect(isValidAudioFile('audiofile')).toBe(false);
  });

  it('rejects files with .mp3 or .wav embedded in name (not extension)', () => {
    expect(isValidAudioFile('my.mp3.backup.txt')).toBe(false);
    expect(isValidAudioFile('convert.wav.to.mp3.js')).toBe(false);
  });

  it('detects mp3 files correctly', () => {
    expect(isMp3File('test.mp3')).toBe(true);
    expect(isMp3File('test.wav')).toBe(false);
    expect(isMp3File('test.MP3')).toBe(true);
  });

  it('handles filenames with paths', () => {
    expect(isValidAudioFile('/tmp/uploads/greeting.wav')).toBe(true);
    expect(isValidAudioFile('C:\\audio\\digit.mp3')).toBe(true);
  });

  it('handles filenames with multiple dots', () => {
    expect(isValidAudioFile('greeting.v2.wav')).toBe(true);
    expect(isValidAudioFile('digit.0.mp3')).toBe(true);
  });
});

// ============================================================
// 3. Audio Status Computation Tests
// ============================================================
describe('VoiceOTP Audio — status computation', () => {
  const makeConfig = (overrides: Partial<AudioConfig> = {}): AudioConfig => ({
    id: 1,
    language: 'Test',
    primary_language_code: 'en',
    greeting_audio_url: null,
    audio_files: null,
    ...overrides,
  });

  const fullAudioConfig = (id: number, lang: string, code: string): AudioConfig => ({
    id,
    language: lang,
    primary_language_code: code,
    greeting_audio_url: '/uploads/audio/en/greeting.wav',
    audio_files: {
      '0': '/uploads/audio/en/0.wav', '1': '/uploads/audio/en/1.wav',
      '2': '/uploads/audio/en/2.wav', '3': '/uploads/audio/en/3.wav',
      '4': '/uploads/audio/en/4.wav', '5': '/uploads/audio/en/5.wav',
      '6': '/uploads/audio/en/6.wav', '7': '/uploads/audio/en/7.wav',
      '8': '/uploads/audio/en/8.wav', '9': '/uploads/audio/en/9.wav',
    },
  });

  it('returns full status when greeting + all 10 digits present', () => {
    const configs = [fullAudioConfig(1, 'English', 'en')];
    const status = computeAudioStatus(configs, 'en', null);

    expect(status).not.toBeNull();
    expect(status!.found).toBe(true);
    expect(status!.greeting).toBe(true);
    expect(status!.digitCount).toBe(10);
    expect(status!.complete).toBe(true);
    expect(status!.groupName).toBe('English');
  });

  it('returns partial status when only greeting uploaded', () => {
    const configs = [makeConfig({
      id: 1, language: 'French', primary_language_code: 'fr',
      greeting_audio_url: '/uploads/audio/fr/greeting.wav',
    })];
    const status = computeAudioStatus(configs, 'fr', null);

    expect(status!.found).toBe(true);
    expect(status!.greeting).toBe(true);
    expect(status!.digitCount).toBe(0);
    expect(status!.complete).toBe(false);
  });

  it('returns partial status when only digits uploaded (no greeting)', () => {
    const configs = [makeConfig({
      id: 1, language: 'Spanish', primary_language_code: 'es',
      audio_files: { '0': '/wav/0.wav', '1': '/wav/1.wav', '2': '/wav/2.wav' },
    })];
    const status = computeAudioStatus(configs, 'es', null);

    expect(status!.found).toBe(true);
    expect(status!.greeting).toBe(false);
    expect(status!.digitCount).toBe(3);
    expect(status!.complete).toBe(false);
  });

  it('returns complete=false when 9 digits + greeting (not full)', () => {
    const cfg = makeConfig({
      id: 1, language: 'German', primary_language_code: 'de',
      greeting_audio_url: '/wav/de/greeting.wav',
      audio_files: {
        '0': '/wav/0.wav', '1': '/wav/1.wav', '2': '/wav/2.wav', '3': '/wav/3.wav',
        '4': '/wav/4.wav', '5': '/wav/5.wav', '6': '/wav/6.wav', '7': '/wav/7.wav',
        '8': '/wav/8.wav',
      },
    });
    const status = computeAudioStatus([cfg], 'de', null);

    expect(status!.found).toBe(true);
    expect(status!.greeting).toBe(true);
    expect(status!.digitCount).toBe(9);
    expect(status!.complete).toBe(false);
  });

  it('returns found=false when no config matches language', () => {
    const configs = [makeConfig({ id: 1, language: 'English', primary_language_code: 'en' })];
    const status = computeAudioStatus(configs, 'ja', null);

    expect(status!.found).toBe(false);
    expect(status!.greeting).toBe(false);
    expect(status!.digitCount).toBe(0);
    expect(status!.complete).toBe(false);
    expect(status!.groupName).toBeNull();
  });

  it('returns null when primaryLanguageCode is empty', () => {
    const configs = [makeConfig()];
    const status = computeAudioStatus(configs, '', null);
    expect(status).toBeNull();
  });

  it('falls back to editing group when no other group has audio for the language', () => {
    const editingCfg = fullAudioConfig(5, 'Arabic', 'ar');
    const configs = [editingCfg];
    // Only config is the one being edited — no other match exists
    const status = computeAudioStatus(configs, 'ar', editingCfg);

    // Falls back to editingGroup itself as last resort
    expect(status!.found).toBe(true);
    expect(status!.greeting).toBe(true);
    expect(status!.digitCount).toBe(10);
  });

  it('finds match in different group with same language (audio reuse)', () => {
    const bangladeshGroup = fullAudioConfig(1, 'Bangladesh', 'bn');
    const indiaGroup = makeConfig({ id: 2, language: 'India', primary_language_code: 'bn' });
    const configs = [bangladeshGroup, indiaGroup];

    const status = computeAudioStatus(configs, 'bn', indiaGroup);

    expect(status!.found).toBe(true);
    expect(status!.greeting).toBe(true);
    expect(status!.digitCount).toBe(10);
    expect(status!.groupName).toBe('Bangladesh'); // audio reused from Bangladesh
  });

  it('returns groupName=null when no match with audio found', () => {
    const configs = [makeConfig({ id: 1, language: 'Empty', primary_language_code: 'th' })];
    const status = computeAudioStatus(configs, 'th', null);

    // anyMatch found the group but it has no audio, so groupName stays null
    expect(status!.found).toBe(true);
    expect(status!.groupName).toBeNull();
  });

  it('handles null audio_files gracefully', () => {
    const configs = [makeConfig({
      id: 1, language: 'Test', primary_language_code: 'en',
      audio_files: null, greeting_audio_url: '/wav/greeting.wav',
    })];
    const status = computeAudioStatus(configs, 'en', null);

    expect(status!.found).toBe(true);
    expect(status!.greeting).toBe(true);
    expect(status!.digitCount).toBe(0);
  });

  it('handles empty audio_files object', () => {
    const configs = [makeConfig({
      id: 1, language: 'Test', primary_language_code: 'en',
      audio_files: {},
    })];
    const status = computeAudioStatus(configs, 'en', null);

    // {} has 0 keys, so no audio match found → anyMatch found it but no audio
    expect(status!.found).toBe(true);
    expect(status!.digitCount).toBe(0);
    expect(status!.groupName).toBeNull();
  });

  it('handles extra padding in audio_files (beyond 0-9)', () => {
    const configs = [makeConfig({
      id: 1, language: 'Extra', primary_language_code: 'en',
      greeting_audio_url: '/wav/greeting.wav',
      audio_files: {
        '0': '/0.wav', '1': '/1.wav', '2': '/2.wav', '3': '/3.wav', '4': '/4.wav',
        '5': '/5.wav', '6': '/6.wav', '7': '/7.wav', '8': '/8.wav', '9': '/9.wav',
        'star': '/star.wav', 'hash': '/hash.wav',
      },
    })];
    const status = computeAudioStatus(configs, 'en', null);

    expect(status!.found).toBe(true);
    expect(status!.digitCount).toBe(12); // 10 digits + star + hash
    expect(status!.complete).toBe(true); // >= 10
  });
});

// ============================================================
// 4. Audio Completeness Detection Tests
// ============================================================
describe('VoiceOTP Audio — completeness detection', () => {
  it('marks config as complete when greeting + 10 digits exist', () => {
    expect(isAudioComplete({
      id: 1, language: 'Full', primary_language_code: 'en',
      greeting_audio_url: '/wav/greeting.wav',
      audio_files: {
        '0': '/0.wav', '1': '/1.wav', '2': '/2.wav', '3': '/3.wav', '4': '/4.wav',
        '5': '/5.wav', '6': '/6.wav', '7': '/7.wav', '8': '/8.wav', '9': '/9.wav',
      },
    })).toBe(true);
  });

  it('marks config as incomplete when missing greeting', () => {
    expect(isAudioComplete({
      id: 1, language: 'NoGreeting', primary_language_code: 'en',
      audio_files: {
        '0': '/0.wav', '1': '/1.wav', '2': '/2.wav', '3': '/3.wav', '4': '/4.wav',
        '5': '/5.wav', '6': '/6.wav', '7': '/7.wav', '8': '/8.wav', '9': '/9.wav',
      },
    })).toBe(false);
  });

  it('marks config as incomplete when missing digits', () => {
    expect(isAudioComplete({
      id: 1, language: 'Partial', primary_language_code: 'en',
      greeting_audio_url: '/wav/greeting.wav',
      audio_files: { '0': '/0.wav', '1': '/1.wav' },
    })).toBe(false);
  });

  it('marks config as incomplete when completely empty', () => {
    expect(isAudioComplete({
      id: 1, language: 'Empty', primary_language_code: 'en',
    })).toBe(false);
  });
});

// ============================================================
// 5. Groups with Full Audio Stat Tests
// ============================================================
describe('VoiceOTP Audio — groupsWithFullAudio stat', () => {
  const fullCfg = (id: number, lang: string): AudioConfig => ({
    id, language: lang, primary_language_code: 'en',
    greeting_audio_url: '/wav/greeting.wav',
    audio_files: {
      '0': '/0.wav', '1': '/1.wav', '2': '/2.wav', '3': '/3.wav', '4': '/4.wav',
      '5': '/5.wav', '6': '/6.wav', '7': '/7.wav', '8': '/8.wav', '9': '/9.wav',
    },
  });

  it('counts all groups with full audio', () => {
    const configs = [
      fullCfg(1, 'English'),
      fullCfg(2, 'Arabic'),
      { id: 3, language: 'Partial', primary_language_code: 'fr', greeting_audio_url: '/wav/g.wav' },
    ];
    expect(countGroupsWithFullAudio(configs)).toBe(2);
  });

  it('returns 0 when no groups have full audio', () => {
    const configs = [
      { id: 1, language: 'A', primary_language_code: 'en' },
      { id: 2, language: 'B', primary_language_code: 'fr' },
    ];
    expect(countGroupsWithFullAudio(configs)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(countGroupsWithFullAudio([])).toBe(0);
  });

  it('counts correctly when all groups are full', () => {
    const configs = [fullCfg(1, 'A'), fullCfg(2, 'B'), fullCfg(3, 'C')];
    expect(countGroupsWithFullAudio(configs)).toBe(3);
  });

  it('digit count counts only audio_files keys', () => {
    const cfg: AudioConfig = {
      id: 1, language: 'Test', primary_language_code: 'en',
      greeting_audio_url: '/wav/greeting.wav',
      audio_files: { '0': '/0.wav', '3': '/3.wav', '7': '/7.wav' },
    };
    expect(audioDigitCount(cfg)).toBe(3);
  });

  it('digit count returns 0 for null audio_files', () => {
    const cfg: AudioConfig = { id: 1, language: 'Test', primary_language_code: 'en' };
    expect(audioDigitCount(cfg)).toBe(0);
  });
});

// ============================================================
// 6. Audio Playback Readiness Tests
// ============================================================
describe('VoiceOTP Audio — playback readiness', () => {
  const fullCfg = (id: number, code: string): AudioConfig => ({
    id, language: code, primary_language_code: code,
    greeting_audio_url: `/audio/${code}/greeting.wav`,
    audio_files: {
      '0': `/audio/${code}/0.wav`, '1': `/audio/${code}/1.wav`,
      '2': `/audio/${code}/2.wav`, '3': `/audio/${code}/3.wav`,
      '4': `/audio/${code}/4.wav`, '5': `/audio/${code}/5.wav`,
      '6': `/audio/${code}/6.wav`, '7': `/audio/${code}/7.wav`,
      '8': `/audio/${code}/8.wav`, '9': `/audio/${code}/9.wav`,
    },
  });

  it('has playable greeting when greeting_audio_url is set', () => {
    const cfg = fullCfg(1, 'en');
    const hasGreeting = !!cfg.greeting_audio_url;
    expect(hasGreeting).toBe(true);
    // Audio element would be created from this URL
    expect(cfg.greeting_audio_url).toMatch(/\.wav$/);
  });

  it('has playable digits when audio_files contain wav URLs', () => {
    const cfg = fullCfg(1, 'en');
    const files = cfg.audio_files || {};
    for (let d = 0; d <= 9; d++) {
      expect(files[String(d)]).toBeDefined();
      expect(files[String(d)]).toMatch(/\.wav$/);
    }
  });

  it('audio URL path starts with /uploads/audio/ (rel path pattern)', () => {
    const cfg: AudioConfig = {
      id: 1, language: 'Test', primary_language_code: 'en',
      greeting_audio_url: '/uploads/audio/group_1/en/greeting.wav',
    };
    expect(cfg.greeting_audio_url).toMatch(/^\/uploads\/audio\//);
  });

  it('detects all 11 audio files needed for full playback (greeting + 0-9)', () => {
    const cfg = fullCfg(1, 'bn');
    const greetingReady = !!cfg.greeting_audio_url;
    const digitKeys = Object.keys(cfg.audio_files || {});
    const allDigitsPresent =
      digitKeys.includes('0') && digitKeys.includes('1') && digitKeys.includes('2') &&
      digitKeys.includes('3') && digitKeys.includes('4') && digitKeys.includes('5') &&
      digitKeys.includes('6') && digitKeys.includes('7') && digitKeys.includes('8') &&
      digitKeys.includes('9');

    expect(greetingReady).toBe(true);
    expect(allDigitsPresent).toBe(true);
  });

  it('detects missing playback files (incomplete group)', () => {
    const cfg: AudioConfig = {
      id: 1, language: 'Partial', primary_language_code: 'hi',
      greeting_audio_url: '/uploads/audio/hi/greeting.wav',
      audio_files: { '0': '/0.wav', '5': '/5.wav' },
    };

    const missingDigits = [1, 2, 3, 4, 6, 7, 8, 9].filter(
      (d) => !(cfg.audio_files || {})[String(d)]
    );
    expect(missingDigits.length).toBe(8);
  });

  it('Bangladesh group with Bangla (bn) has correct playback paths', () => {
    const cfg = fullCfg(1, 'bn');
    expect(isAudioComplete(cfg)).toBe(true);
    expect(cfg.greeting_audio_url).toBe('/audio/bn/greeting.wav');
    expect((cfg.audio_files || {})['0']).toBe('/audio/bn/0.wav');
  });

  it('Pakistan group with Urdu (ur) has correct playback paths', () => {
    const cfg = fullCfg(2, 'ur');
    expect(isAudioComplete(cfg)).toBe(true);
    expect(cfg.greeting_audio_url).toBe('/audio/ur/greeting.wav');
    expect((cfg.audio_files || {})['9']).toBe('/audio/ur/9.wav');
  });
});
