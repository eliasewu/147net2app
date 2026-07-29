-- Voice OTP Enhancement Migration
-- Adds new columns to voice_otp_configs and global SIP settings to platform_settings

-- 1. Add new columns to voice_otp_configs
ALTER TABLE voice_otp_configs 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 2;

-- 2. Add global SIP settings to platform_settings (idempotent)
INSERT INTO platform_settings (key, value) VALUES
('voice_otp_sip_host', ''),
('voice_otp_sip_port', '5060'),
('voice_otp_sip_username', ''),
('voice_otp_sip_password', ''),
('voice_otp_caller_id', ''),
('voice_otp_is_e164', 'true'),
('voice_otp_audio_codec', 'g711')
ON CONFLICT (key) DO NOTHING;
