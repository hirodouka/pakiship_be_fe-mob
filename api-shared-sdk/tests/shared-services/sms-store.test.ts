import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const repoRoot = join(__dirname, '..', '..');
const {
  createMemorySmsStore,
  createSmsStore,
} = require(join(repoRoot, 'shared-services/sms-gateway/src/store.js'));

describe('sms gateway store', () => {
  it('stores and updates message status through the memory store', async () => {
    const store = createMemorySmsStore();
    const entry = {
      messageId: 'msg_test',
      to: '+639171234567',
      message: 'Hello',
      status: 'mock_sent',
      createdAt: new Date().toISOString(),
    };

    await store.createMessage(entry);
    expect(await store.getMessage('msg_test')).toEqual(entry);

    await store.updateMessage('msg_test', { status: 'delivered' });
    expect(await store.getMessage('msg_test')).toEqual({ ...entry, status: 'delivered' });
  });

  it('fails fast in production when Redis is not configured', () => {
    expect(() =>
      createSmsStore({
        NODE_ENV: 'production',
      }),
    ).toThrow('SMS Redis storage requires SMS_REDIS_URL or REDIS_URL.');
  });

  it('rejects memory store mode in production', () => {
    expect(() =>
      createSmsStore({
        NODE_ENV: 'production',
        SMS_STORE_MODE: 'memory',
      }),
    ).toThrow('SMS_STORE_MODE=memory is not allowed in production.');
  });
});
