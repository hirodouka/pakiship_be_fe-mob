import { createRequire } from 'node:module';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestApp } from './httpApp';

const require = createRequire(import.meta.url);
const repoRoot = join(__dirname, '..', '..');

interface ApiBody<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

function loadGateway(relativePath: string, env: Record<string, string | undefined> = {}) {
  const resolvedPath = require.resolve(join(repoRoot, relativePath));

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  delete require.cache[resolvedPath];
  return require(resolvedPath).app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shared-service runtime gateways', () => {
  it('email gateway handles health, send, status, validation, and not-found routes', async () => {
    const app = loadGateway('shared-services/email-gateway/src/server.js', {
      NODE_ENV: 'test',
      RESEND_API_KEY: undefined,
    });

    const health = await requestApp<ApiBody>(app, { path: '/health' });
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);

    const invalid = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/send',
      body: {},
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.success).toBe(false);

    const sent = await requestApp<ApiBody<{ messageId: string; status: string }>>(app, {
      method: 'POST',
      path: '/send',
      body: {
        to: 'user@example.com',
        subject: 'Receipt',
        text: 'Thanks for your order',
      },
    });
    expect(sent.status).toBe(201);
    expect(sent.body.success).toBe(true);
    expect(sent.body.data?.messageId).toMatch(/^msg_/);

    const status = await requestApp<ApiBody<{ messageId: string }>>(app, {
      path: `/status/${sent.body.data?.messageId}`,
    });
    expect(status.status).toBe(200);
    expect(status.body.data?.messageId).toBe(sent.body.data?.messageId);

    const missing = await requestApp<ApiBody>(app, { path: '/status/missing-message' });
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
  });

  it('sms gateway handles health, send, status, validation, and not-found routes', async () => {
    const app = loadGateway('shared-services/sms-gateway/src/server.js');

    const health = await requestApp<ApiBody>(app, { path: '/health' });
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);

    const invalid = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/send',
      body: { to: '+639171234567' },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.success).toBe(false);

    const sent = await requestApp<ApiBody<{ messageId: string }>>(app, {
      method: 'POST',
      path: '/send',
      body: {
        to: '+639171234567',
        message: 'Your verification code is 123456',
      },
    });
    expect(sent.status).toBe(201);
    expect(sent.body.success).toBe(true);
    expect(sent.body.data?.messageId).toMatch(/^msg_/);

    const status = await requestApp<ApiBody<{ messageId: string }>>(app, {
      path: `/status/${sent.body.data?.messageId}`,
    });
    expect(status.status).toBe(200);
    expect(status.body.data?.messageId).toBe(sent.body.data?.messageId);

    const missing = await requestApp<ApiBody>(app, { path: '/status/missing-message' });
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
  });

  it('Google auth gateway handles health, authorization success, validation, and not-found routes', async () => {
    const app = loadGateway('shared-services/gauth-gateway/src/server.js', {
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_REDIRECT_URI: undefined,
    });

    const health = await requestApp<ApiBody>(app, { path: '/health' });
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);

    const invalid = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/oauth/authorize',
      body: {},
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.success).toBe(false);

    const authorized = await requestApp<ApiBody<{ authorizationUrl: string; state: string }>>(app, {
      method: 'POST',
      path: '/oauth/authorize',
      body: {
        redirectUri: 'https://app.example.com/oauth/callback',
        state: 'state-123',
        scopes: ['openid', 'email'],
      },
    });
    expect(authorized.status).toBe(200);
    expect(authorized.body.success).toBe(true);
    expect(authorized.body.data?.authorizationUrl).toContain('client_id=google-client-id');
    expect(authorized.body.data?.state).toBe('state-123');

    const missing = await requestApp<string>(app, { path: '/oauth/missing' });
    expect(missing.status).toBe(404);
  });

  it('otp gateway handles health, generate, verify, validation, and not-found routes', async () => {
    const app = loadGateway('shared-services/otp-gateway/src/server.js', {
      NODE_ENV: 'test',
    });

    const health = await requestApp<ApiBody>(app, { path: '/health' });
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);

    const invalid = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/generate',
      body: { target: '+639171234567' },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.success).toBe(false);

    const generated = await requestApp<ApiBody<{ otpId: string; code?: string }>>(app, {
      method: 'POST',
      path: '/generate',
      body: {
        target: '+639171234567',
        channel: 'sms',
        length: 6,
      },
    });
    expect(generated.status).toBe(201);
    expect(generated.body.success).toBe(true);
    expect(generated.body.data?.otpId).toMatch(/^otp_/);

    const verified = await requestApp<ApiBody<{ valid: boolean }>>(app, {
      method: 'POST',
      path: '/verify',
      body: {
        otpId: generated.body.data?.otpId,
        code: generated.body.data?.code,
      },
    });
    expect(verified.status).toBe(200);
    expect(verified.body.data?.valid).toBe(true);

    const missing = await requestApp<ApiBody>(app, { path: '/status/missing-otp' });
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
  });

  it('PayMongo gateway handles health, checkout, refund, validation, and not-found routes', async () => {
    const app = loadGateway('shared-services/paymongo/src/server.js');

    const health = await requestApp<ApiBody>(app, { path: '/health' });
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);

    const invalidCheckout = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      body: {},
    });
    expect(invalidCheckout.status).toBe(400);
    expect(invalidCheckout.body.success).toBe(false);

    const checkout = await requestApp<ApiBody<{
      checkoutId: string;
      provider: string;
      paymentMethodsAllowed: string[];
    }>>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'checkout-runtime-test' },
      body: {
        referenceId: 'order-123',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        paymentMethods: ['card', 'gcash', 'maya', 'grabpay', 'qrph'],
        lineItems: [
          {
            name: 'Starter Plan',
            quantity: 1,
            amount: { value: 99900, currency: 'PHP' },
          },
        ],
      },
    });
    expect(checkout.status).toBe(201);
    expect(checkout.body.success).toBe(true);
    expect(checkout.body.data?.checkoutId).toMatch(/^mock_/);
    expect(checkout.body.data?.provider).toBe('paymongo');
    expect(checkout.body.data?.paymentMethodsAllowed).toEqual([
      'card',
      'gcash',
      'paymaya',
      'grab_pay',
      'qrph',
    ]);

    const invalidRefund = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/payments/pay_123/refunds',
      body: {},
    });
    expect(invalidRefund.status).toBe(400);
    expect(invalidRefund.body.success).toBe(false);

    const refund = await requestApp<ApiBody<{ refundId: string; paymentId: string }>>(app, {
      method: 'POST',
      path: '/payments/pay_123/refunds',
      headers: { 'Idempotency-Key': 'refund-runtime-test' },
      body: {
        amount: { value: 5000, currency: 'PHP' },
        reason: 'customer_request',
      },
    });
    expect(refund.status).toBe(201);
    expect(refund.body.success).toBe(true);
    expect(refund.body.data?.paymentId).toBe('pay_123');

    const missing = await requestApp<string>(app, { path: '/missing-route' });
    expect(missing.status).toBe(404);
  });

  it('geo gateway handles health, geocode, reverse geocode, geofence, and validation routes', async () => {
    const app = loadGateway('shared-services/geo-gateway/src/server.js', {
      NODE_ENV: 'test',
      GOOGLE_MAPS_API_KEY: undefined,
    });

    const health = await requestApp<ApiBody>(app, { path: '/health' });
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);

    const invalidGeocode = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/geocode',
      body: {},
    });
    expect(invalidGeocode.status).toBe(400);
    expect(invalidGeocode.body.success).toBe(false);

    const geocoded = await requestApp<ApiBody<{ formattedAddress: string; provider: string }>>(app, {
      method: 'POST',
      path: '/geocode',
      body: { address: 'Manila, Philippines' },
    });
    expect(geocoded.status).toBe(200);
    expect(geocoded.body.success).toBe(true);
    expect(geocoded.body.data?.formattedAddress).toBe('Manila, Philippines');
    expect(geocoded.body.data?.provider).toBe('mock');

    const reverseGeocoded = await requestApp<ApiBody<{ formattedAddress: string; provider: string }>>(app, {
      method: 'POST',
      path: '/reverse-geocode',
      body: {
        latitude: 14.5995,
        longitude: 120.9842,
      },
    });
    expect(reverseGeocoded.status).toBe(200);
    expect(reverseGeocoded.body.success).toBe(true);
    expect(reverseGeocoded.body.data?.formattedAddress).toBe('Manila, Philippines');

    const checked = await requestApp<ApiBody<{ inside: boolean; distanceDetails: unknown[] }>>(app, {
      method: 'POST',
      path: '/geofence/check',
      body: {
        latitude: 14.5995,
        longitude: 120.9842,
        fenceId: 'metro-manila',
      },
    });
    expect(checked.status).toBe(200);
    expect(checked.body.success).toBe(true);
    expect(checked.body.data?.inside).toBe(true);
    expect(checked.body.data?.distanceDetails).toHaveLength(1);
  });
});
