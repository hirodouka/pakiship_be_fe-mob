import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const repoRoot = join(__dirname, '..', '..');
const {
  createMemoryOtpStore,
  createOtpStore,
} = require(join(repoRoot, 'shared-services/otp-gateway/src/store.js'));

describe('otp gateway store', () => {
  it('stores and updates OTP entries through the memory store', async () => {
    const store = createMemoryOtpStore();
    const entry = {
      otpId: 'otp_test',
      target: '+639171234567',
      channel: 'sms',
      code: '123456',
      expiresAt: Date.now() + 300_000,
      status: 'pending',
    };

    await store.createOtp(entry);
    expect(await store.getOtp('otp_test')).toEqual(entry);

    await store.updateOtp('otp_test', { status: 'used' });
    expect(await store.getOtp('otp_test')).toEqual({ ...entry, status: 'used' });
  });

  it('fails fast in production when Redis is not configured', () => {
    expect(() =>
      createOtpStore({
        NODE_ENV: 'production',
      }),
    ).toThrow('OTP Redis storage requires OTP_REDIS_URL or REDIS_URL.');
  });

  it('rejects memory store mode in production', () => {
    expect(() =>
      createOtpStore({
        NODE_ENV: 'production',
        OTP_STORE_MODE: 'memory',
      }),
    ).toThrow('OTP_STORE_MODE=memory is not allowed in production.');
  });
});
