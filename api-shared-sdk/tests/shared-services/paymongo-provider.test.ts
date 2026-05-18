import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestApp } from './httpApp';

const require = createRequire(import.meta.url);
const repoRoot = join(__dirname, '..', '..');

interface ApiBody<T = Record<string, unknown>> {
  success?: boolean;
  received?: boolean;
  event?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

function loadPayMongoGateway(env: Record<string, string | undefined> = {}) {
  const resolvedPath = require.resolve(join(repoRoot, 'shared-services/paymongo/src/server.js'));

  for (const key of [
    'NODE_ENV',
    'PAYMENT_PROVIDER_MODE',
    'PAYMONGO_SECRET_KEY',
    'PAYMONGO_TEST_SECRET_KEY',
    'PAYMONGO_LIVE_SECRET_KEY',
    'PAYMONGO_WEBHOOK_SECRET',
    'PAYMONGO_TEST_WEBHOOK_SECRET',
    'PAYMONGO_LIVE_WEBHOOK_SECRET',
    'PAYMONGO_WEBHOOK_MODE',
    'PAYMONGO_ALLOWED_PAYMENT_METHODS',
    'PAYMONGO_DEFAULT_PAYMENT_METHODS',
    'PAYMENT_SUBSCRIPTIONS_ENABLED',
    'SHARED_SERVICES_DATABASE_ENABLED',
    'SHARED_SERVICES_DATABASE_URL',
    'PAYMONGO_PAYMENT_STORE_MODE',
  ]) {
    delete process.env[key];
  }

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
  vi.unstubAllGlobals();
});

describe('PayMongo provider runtime', () => {
  it('returns 400 when checkout creation is missing an idempotency key', async () => {
    const app = loadPayMongoGateway();

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      body: {
        referenceId: 'order-123',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('returns a controlled disabled response for subscription checkout mode', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_123',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
    });

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'subscription-checkout-test' },
      body: {
        mode: 'subscription',
        referenceId: 'sub-order-123',
        customerId: 'cus_123',
        priceId: 'price_123',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        lineItems: [{ name: 'Monthly Plan', quantity: 1, amount: { value: 9900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(501);
    expect(response.body.error?.code).toBe('SUBSCRIPTIONS_DISABLED');
  });

  it('exposes subscription routes with controlled disabled and not-found responses', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_123',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
    });

    const createResponse = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/subscriptions',
      headers: {
        'Idempotency-Key': 'sub-create-test',
        'X-Tribe-ID': 'orders-service',
      },
      body: {
        referenceId: 'church_123_basic',
        customerId: 'cus_123',
        priceId: 'price_123',
      },
    });

    const readResponse = await requestApp<ApiBody>(app, {
      method: 'GET',
      path: '/subscriptions/sub_123',
      headers: { 'X-Tribe-ID': 'orders-service' },
    });

    expect(createResponse.status).toBe(501);
    expect(createResponse.body.error?.code).toBe('SUBSCRIPTIONS_DISABLED');
    expect(readResponse.status).toBe(404);
    expect(readResponse.body.error?.code).toBe('NOT_FOUND');
  });

  it('creates catalog records when payment persistence is enabled', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_123',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
    });

    const customerResponse = await requestApp<ApiBody<{ customerId: string }>>(app, {
      method: 'POST',
      path: '/customers',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        email: 'buyer@example.com',
        name: 'Buyer Example',
      },
    });
    const productResponse = await requestApp<ApiBody<{ productId: string }>>(app, {
      method: 'POST',
      path: '/products',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        name: 'Basic Membership',
      },
    });
    const priceResponse = await requestApp<ApiBody<{ priceId: string }>>(app, {
      method: 'POST',
      path: '/prices',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        productId: productResponse.body.data?.productId,
        amount: { value: 9900, currency: 'PHP' },
        recurring: { interval: 'month', intervalCount: 1 },
      },
    });

    expect(customerResponse.status).toBe(201);
    expect(customerResponse.body.data?.customerId).toMatch(/^cus_/);
    expect(productResponse.status).toBe(201);
    expect(productResponse.body.data?.productId).toMatch(/^prod_/);
    expect(priceResponse.status).toBe(201);
    expect(priceResponse.body.data?.priceId).toMatch(/^price_/);

    const getCustomerResponse = await requestApp<ApiBody>(app, {
      method: 'GET',
      path: `/customers/${customerResponse.body.data?.customerId}`,
      headers: { 'X-Tribe-ID': 'orders-service' },
    });
    const crossTribeResponse = await requestApp<ApiBody>(app, {
      method: 'GET',
      path: `/customers/${customerResponse.body.data?.customerId}`,
      headers: { 'X-Tribe-ID': 'other-service' },
    });

    expect(getCustomerResponse.status).toBe(200);
    expect(crossTribeResponse.status).toBe(404);
  });

  it('creates and manages a memory-mode subscription when subscriptions are enabled', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_123',
      PAYMENT_SUBSCRIPTIONS_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
    });

    const customerResponse = await requestApp<ApiBody<{ customerId: string }>>(app, {
      method: 'POST',
      path: '/customers',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        email: 'buyer@example.com',
        name: 'Buyer Example',
      },
    });
    const productResponse = await requestApp<ApiBody<{ productId: string }>>(app, {
      method: 'POST',
      path: '/products',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        name: 'Basic Membership',
      },
    });
    const priceResponse = await requestApp<ApiBody<{ priceId: string }>>(app, {
      method: 'POST',
      path: '/prices',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        productId: productResponse.body.data?.productId,
        amount: { value: 9900, currency: 'PHP' },
        recurring: { interval: 'month', intervalCount: 1 },
      },
    });
    const createResponse = await requestApp<ApiBody<{
      subscriptionId: string;
      status: string;
      customerId: string;
      priceId: string;
    }>>(app, {
      method: 'POST',
      path: '/subscriptions',
      headers: {
        'Idempotency-Key': 'sub-create-memory',
        'X-Tribe-ID': 'orders-service',
      },
      body: {
        referenceId: 'church_123_basic',
        customerId: customerResponse.body.data?.customerId,
        priceId: priceResponse.body.data?.priceId,
        trialPeriodDays: 14,
      },
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data?.subscriptionId).toMatch(/^sub_/);
    expect(createResponse.body.data?.status).toBe('trialing');
    expect(createResponse.body.data?.customerId).toBe(customerResponse.body.data?.customerId);
    expect(createResponse.body.data?.priceId).toBe(priceResponse.body.data?.priceId);

    const duplicateCreateResponse = await requestApp<ApiBody<{ subscriptionId: string }>>(app, {
      method: 'POST',
      path: '/subscriptions',
      headers: {
        'Idempotency-Key': 'sub-create-memory',
        'X-Tribe-ID': 'orders-service',
      },
      body: {
        referenceId: 'church_123_basic',
        customerId: customerResponse.body.data?.customerId,
        priceId: priceResponse.body.data?.priceId,
        trialPeriodDays: 14,
      },
    });
    const subscriptionId = createResponse.body.data?.subscriptionId ?? '';
    const getResponse = await requestApp<ApiBody<{ subscriptionId: string }>>(app, {
      method: 'GET',
      path: `/subscriptions/${subscriptionId}`,
      headers: { 'X-Tribe-ID': 'orders-service' },
    });
    const referenceResponse = await requestApp<ApiBody<{ subscriptionId: string }>>(app, {
      method: 'GET',
      path: '/subscriptions/by-reference/church_123_basic',
      headers: { 'X-Tribe-ID': 'orders-service' },
    });
    const cancelResponse = await requestApp<ApiBody<{ status: string; cancelAtPeriodEnd: boolean }>>(app, {
      method: 'POST',
      path: `/subscriptions/${subscriptionId}/cancel`,
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: { cancelAtPeriodEnd: true, reason: 'customer_request' },
    });
    const pauseResponse = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'POST',
      path: `/subscriptions/${subscriptionId}/pause`,
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {},
    });
    const resumeResponse = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'POST',
      path: `/subscriptions/${subscriptionId}/resume`,
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {},
    });
    const annualPriceResponse = await requestApp<ApiBody<{ priceId: string }>>(app, {
      method: 'POST',
      path: '/prices',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        productId: productResponse.body.data?.productId,
        amount: { value: 99000, currency: 'PHP' },
        recurring: { interval: 'year', intervalCount: 1 },
      },
    });
    const changePriceResponse = await requestApp<ApiBody<{ priceId: string }>>(app, {
      method: 'POST',
      path: `/subscriptions/${subscriptionId}/change-price`,
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: { priceId: annualPriceResponse.body.data?.priceId },
    });
    const invoiceListResponse = await requestApp<ApiBody<unknown[]>>(app, {
      method: 'GET',
      path: `/subscriptions/${subscriptionId}/invoices`,
      headers: { 'X-Tribe-ID': 'orders-service' },
    });

    expect(getResponse.status).toBe(200);
    expect(duplicateCreateResponse.body.data?.subscriptionId).toBe(subscriptionId);
    expect(referenceResponse.body.data?.subscriptionId).toBe(subscriptionId);
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.data?.status).toBe('trialing');
    expect(cancelResponse.body.data?.cancelAtPeriodEnd).toBe(true);
    expect(pauseResponse.body.data?.status).toBe('paused');
    expect(resumeResponse.body.data?.status).toBe('active');
    expect(changePriceResponse.body.data?.priceId).toBe(annualPriceResponse.body.data?.priceId);
    expect(invoiceListResponse.status).toBe(200);
    expect(Array.isArray(invoiceListResponse.body.data)).toBe(true);
  });

  it('requires an idempotency key when subscription creation is enabled', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_123',
      PAYMENT_SUBSCRIPTIONS_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
    });

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/subscriptions',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        referenceId: 'missing-key-sub',
        customerId: 'cus_missing',
        priceId: 'price_missing',
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('persists subscription and invoice webhook lifecycle updates idempotently', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_123',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
      PAYMENT_SUBSCRIPTIONS_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    const customerResponse = await requestApp<ApiBody<{ customerId: string }>>(app, {
      method: 'POST',
      path: '/customers',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: { email: 'buyer@example.com' },
    });
    const productResponse = await requestApp<ApiBody<{ productId: string }>>(app, {
      method: 'POST',
      path: '/products',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: { name: 'Basic Membership' },
    });
    const priceResponse = await requestApp<ApiBody<{ priceId: string }>>(app, {
      method: 'POST',
      path: '/prices',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        productId: productResponse.body.data?.productId,
        amount: { value: 9900, currency: 'PHP' },
        recurring: { interval: 'month', intervalCount: 1 },
      },
    });
    const subscriptionResponse = await requestApp<ApiBody<{ subscriptionId: string }>>(app, {
      method: 'POST',
      path: '/subscriptions',
      headers: {
        'Idempotency-Key': 'sub-webhook-test',
        'X-Tribe-ID': 'orders-service',
      },
      body: {
        referenceId: 'church_123_webhook',
        customerId: customerResponse.body.data?.customerId,
        priceId: priceResponse.body.data?.priceId,
      },
    });
    const subscriptionId = subscriptionResponse.body.data?.subscriptionId ?? '';
    const invoicePayload = webhookPayload({
      eventId: 'evt_invoice_paid_once',
      eventType: 'invoice.paid',
      providerData: {
        id: 'inv_subscription_123',
        type: 'invoice',
        attributes: {
          subscription_id: subscriptionId,
          customer_id: customerResponse.body.data?.customerId,
          amount: 9900,
          currency: 'PHP',
        },
      },
    });
    const rawBody = JSON.stringify(invoicePayload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const first = await requestApp<ApiBody<{ invoiceId: string; subscriptionId: string; duplicate: boolean }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: invoicePayload,
    });
    const duplicate = await requestApp<ApiBody<{ duplicate: boolean }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: invoicePayload,
    });
    const invoices = await requestApp<ApiBody<Array<{ invoiceId: string }>>>(app, {
      method: 'GET',
      path: `/subscriptions/${subscriptionId}/invoices`,
      headers: { 'X-Tribe-ID': 'orders-service' },
    });
    const subscription = await requestApp<ApiBody<{ latestInvoiceId: string }>>(app, {
      method: 'GET',
      path: `/subscriptions/${subscriptionId}`,
      headers: { 'X-Tribe-ID': 'orders-service' },
    });

    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      eventType: 'payment.invoice.paid',
      invoiceId: 'inv_subscription_123',
      subscriptionId,
      duplicate: false,
    });
    expect(duplicate.body.data?.duplicate).toBe(true);
    expect(subscription.body.data?.latestInvoiceId).toBe('inv_subscription_123');
    expect(invoices.body.data).toEqual([
      expect.objectContaining({ invoiceId: 'inv_subscription_123' }),
    ]);
  });

  it('rejects subscription creation when the price is not recurring', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_123',
      PAYMENT_SUBSCRIPTIONS_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
    });

    const customerResponse = await requestApp<ApiBody<{ customerId: string }>>(app, {
      method: 'POST',
      path: '/customers',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: { email: 'buyer@example.com' },
    });
    const productResponse = await requestApp<ApiBody<{ productId: string }>>(app, {
      method: 'POST',
      path: '/products',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: { name: 'One-time Item' },
    });
    const priceResponse = await requestApp<ApiBody<{ priceId: string }>>(app, {
      method: 'POST',
      path: '/prices',
      headers: { 'X-Tribe-ID': 'orders-service' },
      body: {
        productId: productResponse.body.data?.productId,
        amount: { value: 9900, currency: 'PHP' },
      },
    });

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/subscriptions',
      headers: {
        'Idempotency-Key': 'sub-non-recurring',
        'X-Tribe-ID': 'orders-service',
      },
      body: {
        referenceId: 'one-time-sub',
        customerId: customerResponse.body.data?.customerId,
        priceId: priceResponse.body.data?.priceId,
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain('recurring price');
  });

  it('creates a checkout session through the live PayMongo API adapter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_live_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_live_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'live',
      PAYMONGO_LIVE_SECRET_KEY: 'sk_live_123',
    });

    const response = await requestApp<ApiBody<{
      checkoutId: string;
      redirectUrl: string;
      paymentMethodsAllowed: string[];
    }>>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'checkout-live-test' },
      body: {
        referenceId: 'order-123',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data?.checkoutId).toBe('cs_live_123');
    expect(response.body.data?.redirectUrl).toBe('https://checkout.paymongo.com/cs_live_123');
    expect(response.body.data?.paymentMethodsAllowed).toEqual([
      'qrph',
      'gcash',
      'grab_pay',
      'paymaya',
      'card',
      'dob',
      'dob_ubp',
      'brankas_bdo',
      'brankas_landbank',
      'brankas_metrobank',
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paymongo.com/v1/checkout_sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('sk_live_123:').toString('base64')}`,
          'Idempotency-Key': 'checkout-live-test',
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      data: {
        attributes: {
          payment_method_types: [
            'qrph',
            'gcash',
            'grab_pay',
            'paymaya',
            'card',
            'dob',
            'dob_ubp',
            'brankas_bdo',
            'brankas_landbank',
            'brankas_metrobank',
          ],
        },
      },
    });
  });

  it('normalizes friendly payment method aliases and only sends enabled methods', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_methods_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_methods_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_mode_key',
      PAYMONGO_ALLOWED_PAYMENT_METHODS: 'card,gcash,paymaya,grab_pay,qrph,dob,dob_ubp,brankas',
    });

    const response = await requestApp<ApiBody<{ paymentMethodsAllowed: string[] }>>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'checkout-methods-test' },
      body: {
        referenceId: 'order-methods',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        paymentMethods: ['visa', 'mastercard', 'maya', 'grabpay', 'direct_online_banking', 'qrph'],
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data?.paymentMethodsAllowed).toEqual([
      'card',
      'paymaya',
      'grab_pay',
      'dob',
      'dob_ubp',
      'brankas_bdo',
      'brankas_landbank',
      'brankas_metrobank',
      'qrph',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      data: {
        attributes: {
          payment_method_types: [
            'card',
            'paymaya',
            'grab_pay',
            'dob',
            'dob_ubp',
            'brankas_bdo',
            'brankas_landbank',
            'brankas_metrobank',
            'qrph',
          ],
        },
      },
    });
  });

  it('rejects requested payment methods that are not enabled by platform policy', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_mode_key',
      PAYMONGO_ALLOWED_PAYMENT_METHODS: 'card,gcash',
    });

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'checkout-disabled-method-test' },
      body: {
        referenceId: 'order-disabled-method',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        paymentMethods: ['card', 'qrph'],
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain('PayMongo payment method is not enabled: qrph');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the PayMongo test key when payment provider mode is test', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_test_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_test_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_mode_key',
      PAYMONGO_LIVE_SECRET_KEY: 'sk_live_mode_key',
    });

    const response = await requestApp<ApiBody<{ checkoutId: string }>>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'checkout-test-mode' },
      body: {
        referenceId: 'order-test',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paymongo.com/v1/checkout_sessions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('sk_test_mode_key:').toString('base64')}`,
        }),
      }),
    );
  });

  it('normalizes PayMongo provider failures to 502 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        errors: [{ detail: 'Provider rejected the checkout request.' }],
      }),
    }));

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'live',
      PAYMONGO_LIVE_SECRET_KEY: 'sk_live_123',
    });

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'checkout-failure-test' },
      body: {
        referenceId: 'order-123',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(502);
    expect(response.body.error?.message).toBe('Provider rejected the checkout request.');
  });

  it('creates a refund through the live PayMongo API adapter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'ref_live_123',
          attributes: {
            status: 'succeeded',
            currency: 'PHP',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'live',
      PAYMONGO_LIVE_SECRET_KEY: 'sk_live_123',
    });

    const response = await requestApp<ApiBody<{ refundId: string; paymentId: string }>>(app, {
      method: 'POST',
      path: '/payments/pay_live_123/refunds',
      headers: { 'Idempotency-Key': 'refund-live-test' },
      body: {
        amount: { value: 5000, currency: 'PHP' },
        reason: 'customer_request',
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data?.refundId).toBe('ref_live_123');
    expect(response.body.data?.paymentId).toBe('pay_live_123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paymongo.com/v1/refunds',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('sk_live_123:').toString('base64')}`,
          'Idempotency-Key': 'refund-live-test',
        }),
      }),
    );
  });

  it('rejects webhooks with invalid PayMongo signatures', async () => {
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
    });

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': 't=1496734173,te=invalid,li=' },
      body: webhookPayload(),
    });

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe('INVALID_SIGNATURE');
  });

  it('accepts webhooks with valid PayMongo signatures', async () => {
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
    });
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
    expect(response.body.event).toBe('checkout_session.payment.paid');
  });

  it('emits redacted diagnostics for accepted webhooks', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
    });
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });

    expect(response.status).toBe(200);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"component":"paymongo-webhook"'));
    const logLines = logSpy.mock.calls.map(([line]) => String(line));
    const diagnostic = logLines.find((line) => line.includes('"component":"paymongo-webhook"'));
    expect(diagnostic).toContain('"event":"checkout_session.payment.paid"');
    expect(diagnostic).toContain('"eventType":"payment.checkout.paid"');
    expect(diagnostic).toContain('"checkoutId":"cs_test"');
    expect(diagnostic).toContain('"paymentIdSet":false');
    expect(diagnostic).not.toContain('webhook-secret');
    expect(diagnostic).not.toContain('Paymongo-Signature');
    expect(diagnostic).not.toContain('rawBody');
    logSpy.mockRestore();
  });

  it('stores checkout sessions and returns normalized status when the payment store is enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_store_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_store_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_mode_key',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    const createResponse = await requestApp<ApiBody<{ checkoutId: string }>>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-store-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-store',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
        metadata: { orderId: 'order-store' },
      },
    });

    expect(createResponse.status).toBe(201);

    const statusResponse = await requestApp<ApiBody<{ status: string; tribeId: string; cancelUrl: string }>>(app, {
      method: 'GET',
      path: '/checkout/sessions/cs_store_123/status',
      headers: { 'X-Tribe-ID': 'servease' },
    });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data).toMatchObject({
      checkoutId: 'cs_store_123',
      tribeId: 'servease',
      referenceId: 'order-store',
      status: 'created',
      cancelUrl: 'https://servease.test/payment/cancelled',
    });
  });

  it('requires tribe context for persisted checkout creation', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_mode_key',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'checkout-missing-tribe' },
      body: {
        referenceId: 'order-missing-tribe',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe('INVALID_REQUEST');
    expect(response.body.error?.message).toContain('tribe context');
  });

  it('marks unpaid checkout sessions as cancelled', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_mode_key',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_cancel_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_cancel_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    }));

    await requestApp(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-cancel-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-cancel',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    const cancelResponse = await requestApp<ApiBody<{ status: string; reason: string }>>(app, {
      method: 'POST',
      path: '/checkout/sessions/cs_cancel_123/cancelled',
      headers: { 'X-Tribe-ID': 'servease' },
      body: { reason: 'user_returned_from_cancel_url' },
    });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.data).toMatchObject({
      checkoutId: 'cs_cancel_123',
      status: 'cancelled',
      reason: 'user_returned_from_cancel_url',
    });
  });

  it('processes paid webhooks idempotently and updates checkout status', async () => {
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_webhook',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_webhook_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_webhook_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    }));

    await requestApp(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-webhook-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-webhook',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    const payload = webhookPayload({
      eventId: 'evt_paid_once',
      checkoutId: 'cs_webhook_123',
      eventType: 'checkout_session.payment.paid',
    });
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const first = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });
    const duplicate = await requestApp<ApiBody<{ duplicate: boolean }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });
    const status = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'GET',
      path: '/checkout/sessions/cs_webhook_123/status',
      headers: { 'X-Tribe-ID': 'servease' },
    });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      received: true,
      event: 'checkout_session.payment.paid',
      data: { status: 'paid' },
    });
    expect(duplicate.body.data).toMatchObject({ duplicate: true });
    expect(status.body.data?.status).toBe('paid');
  });

  it('records the nested payment from checkout-session paid webhooks', async () => {
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_webhook',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_checkout_paid_nested',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_checkout_paid_nested',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    }));

    await requestApp(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-paid-nested-payment-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-paid-nested-payment',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    const payload = webhookPayload({
      eventId: 'evt_checkout_paid_nested',
      eventType: 'checkout_session.payment.paid',
      providerData: {
        id: 'cs_checkout_paid_nested',
        type: 'checkout_session',
        attributes: {
          payments: [
            {
              id: 'pay_checkout_nested_123',
              type: 'payment',
              attributes: {
                amount: 99900,
                currency: 'PHP',
                status: 'paid',
                source: {
                  type: 'gcash',
                },
              },
            },
          ],
        },
      },
    });
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await requestApp<ApiBody<{ paymentId: string; status: string }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });
    const status = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'GET',
      path: '/checkout/sessions/cs_checkout_paid_nested/status',
      headers: { 'X-Tribe-ID': 'servease' },
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      eventType: 'payment.checkout.paid',
      paymentId: 'pay_checkout_nested_123',
      status: 'paid',
    });
    expect(status.body.data?.status).toBe('paid');
  });

  it('repairs the payment row when a duplicate paid webhook is resent', async () => {
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_webhook',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-duplicate-repair',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_duplicate_repair',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_duplicate_repair',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    }));

    await requestApp(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-duplicate-repair-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-duplicate-repair',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    const firstPayload = webhookPayload({
      eventId: 'evt_duplicate_repair',
      eventType: 'checkout_session.payment.paid',
      providerData: {
        id: 'cs_duplicate_repair',
        type: 'checkout_session',
        attributes: {},
      },
    });
    const firstRawBody = JSON.stringify(firstPayload);
    const timestamp = '1496734173';
    const firstSignature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${firstRawBody}`)
      .digest('hex');

    const first = await requestApp<ApiBody<{ paymentId?: string; duplicate: boolean }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${firstSignature},li=` },
      body: firstPayload,
    });

    const repairedPayload = webhookPayload({
      eventId: 'evt_duplicate_repair',
      eventType: 'checkout_session.payment.paid',
      providerData: {
        id: 'cs_duplicate_repair',
        type: 'checkout_session',
        attributes: {
          payments: [
            {
              id: 'pay_duplicate_repair',
              type: 'payment',
              attributes: {
                amount: 99900,
                currency: 'PHP',
                source: { type: 'gcash' },
              },
            },
          ],
        },
      },
    });
    const repairedRawBody = JSON.stringify(repairedPayload);
    const repairedSignature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${repairedRawBody}`)
      .digest('hex');

    const repaired = await requestApp<ApiBody<{ paymentId?: string; duplicate: boolean }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${repairedSignature},li=` },
      body: repairedPayload,
    });
    const { getPaymentStore } = require(join(repoRoot, 'shared-services/paymongo/src/services/paymongo/paymentStore.js'));
    const storedPayment = await getPaymentStore().getPaymentByProviderId('pay_duplicate_repair');

    expect(first.status).toBe(200);
    expect(first.body.data?.paymentId).toBeUndefined();
    expect(repaired.status).toBe(200);
    expect(repaired.body.data).toMatchObject({
      duplicate: true,
      paymentId: 'pay_duplicate_repair',
    });
    expect(storedPayment).toMatchObject({
      paymentId: 'pay_duplicate_repair',
      checkoutId: 'cs_duplicate_repair',
      status: 'paid',
    });
  });

  it('fetches checkout details to create a payment row when a paid checkout webhook has no payment id', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'cs_fallback_checkout',
            attributes: {
              checkout_url: 'https://checkout.paymongo.com/cs_fallback_checkout',
              status: 'active',
              currency: 'PHP',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'cs_fallback_checkout',
            type: 'checkout_session',
            attributes: {
              status: 'paid',
              payments: [
                {
                  id: 'pay_fallback_checkout',
                  type: 'payment',
                  attributes: {
                    amount: 99900,
                    currency: 'PHP',
                    source: { type: 'gcash' },
                  },
                },
              ],
            },
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_webhook',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-checkout-fallback',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    await requestApp(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-fallback-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-checkout-fallback',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    const payload = webhookPayload({
      eventId: 'evt_checkout_fallback',
      eventType: 'checkout_session.payment.paid',
      providerData: {
        id: 'cs_fallback_checkout',
        type: 'checkout_session',
        attributes: {},
      },
    });
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await requestApp<ApiBody<{ paymentId?: string; status: string }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });
    const { getPaymentStore } = require(join(repoRoot, 'shared-services/paymongo/src/services/paymongo/paymentStore.js'));
    const storedPayment = await getPaymentStore().getPaymentByProviderId('pay_fallback_checkout');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      checkoutId: 'cs_fallback_checkout',
      paymentId: 'pay_fallback_checkout',
      status: 'paid',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paymongo.com/v1/checkout_sessions/cs_fallback_checkout',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(storedPayment).toMatchObject({
      paymentId: 'pay_fallback_checkout',
      checkoutId: 'cs_fallback_checkout',
      status: 'paid',
    });
  });

  it('does not preserve unknown tribe ownership when a later webhook resolves the checkout', async () => {
    const paymentStoreSource = readFileSync(
      join(repoRoot, 'shared-services/paymongo/src/services/paymongo/paymentStore.js'),
      'utf8',
    );

    expect(paymentStoreSource).toContain("when excluded.tribe_id <> 'unknown'");
    expect(paymentStoreSource).toContain('then excluded.tribe_id');
    expect(paymentStoreSource).toContain('else shared_payment.payments.tribe_id');
  });

  it('processes failed payment webhooks idempotently and updates checkout status', async () => {
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_webhook',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_failed_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_failed_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    }));

    await requestApp(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-failed-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-failed',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    const payload = webhookPayload({
      eventId: 'evt_failed_once',
      eventType: 'payment.failed',
      providerData: {
        id: 'pay_failed_123',
        type: 'payment',
        attributes: {
          checkout_id: 'cs_failed_123',
          amount: 99900,
          currency: 'PHP',
          payment_method_type: 'gcash',
        },
      },
    });
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const first = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });
    const duplicate = await requestApp<ApiBody<{ duplicate: boolean }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });
    const status = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'GET',
      path: '/checkout/sessions/cs_failed_123/status',
      headers: { 'X-Tribe-ID': 'servease' },
    });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      received: true,
      event: 'payment.failed',
      data: {
        eventType: 'payment.failed',
        paymentId: 'pay_failed_123',
        status: 'failed',
      },
    });
    expect(duplicate.body.data).toMatchObject({ duplicate: true });
    expect(status.body.data?.status).toBe('failed');
  });

  it('records refund update webhooks without exposing webhook secrets in responses', async () => {
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_webhook',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_refund_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_refund_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    }));

    await requestApp(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-refund-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-refund',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    const payload = webhookPayload({
      eventId: 'evt_refund_once',
      eventType: 'payment.refund.updated',
      providerData: {
        id: 'ref_refund_123',
        type: 'refund',
        attributes: {
          payment_id: 'pay_refund_123',
          checkout_id: 'cs_refund_123',
          amount: 50000,
          currency: 'PHP',
        },
      },
    });
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await requestApp<ApiBody<{ refundId: string; status: string }>>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });
    const status = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'GET',
      path: '/checkout/sessions/cs_refund_123/status',
      headers: { 'X-Tribe-ID': 'servease' },
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      eventType: 'payment.refund.updated',
      refundId: 'ref_refund_123',
      paymentId: 'pay_refund_123',
      status: 'refunded',
    });
    expect(JSON.stringify(response.body)).not.toContain('webhook-secret');
    expect(status.body.data?.status).toBe('refunded');
  });

  it('does not allow a paid checkout session to be marked cancelled', async () => {
    const app = loadPayMongoGateway({
      PAYMONGO_TEST_SECRET_KEY: 'sk_test_webhook',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'webhook-secret',
      SHARED_SERVICES_DATABASE_ENABLED: 'true',
      SHARED_SERVICES_DATABASE_URL: 'memory://paymongo-test',
      PAYMONGO_PAYMENT_STORE_MODE: 'memory',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'cs_paid_cancel_123',
          attributes: {
            checkout_url: 'https://checkout.paymongo.com/cs_paid_cancel_123',
            status: 'active',
            currency: 'PHP',
          },
        },
      }),
    }));

    await requestApp(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: {
        'Idempotency-Key': 'checkout-paid-cancel-test',
        'X-Tribe-ID': 'servease',
      },
      body: {
        referenceId: 'order-paid-cancel',
        successUrl: 'https://servease.test/payment/success',
        cancelUrl: 'https://servease.test/payment/cancelled',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    const payload = webhookPayload({
      eventId: 'evt_paid_before_cancel',
      checkoutId: 'cs_paid_cancel_123',
      eventType: 'checkout_session.payment.paid',
    });
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    await requestApp(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });

    const cancelResponse = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/checkout/sessions/cs_paid_cancel_123/cancelled',
      headers: { 'X-Tribe-ID': 'servease' },
      body: { reason: 'user_returned_from_cancel_url' },
    });
    const status = await requestApp<ApiBody<{ status: string }>>(app, {
      method: 'GET',
      path: '/checkout/sessions/cs_paid_cancel_123/status',
      headers: { 'X-Tribe-ID': 'servease' },
    });

    expect(cancelResponse.status).toBe(409);
    expect(cancelResponse.body.error?.message).toContain('cannot be marked cancelled');
    expect(status.body.data?.status).toBe('paid');
  });

  it('uses the live webhook secret and live signature field in live mode', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'live',
      PAYMONGO_TEST_WEBHOOK_SECRET: 'test-webhook-secret',
      PAYMONGO_LIVE_WEBHOOK_SECRET: 'live-webhook-secret',
    });
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'live-webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=wrong,li=${signature}` },
      body: payload,
    });

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  it('rejects the legacy single PayMongo secret key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'cs_legacy', attributes: {} } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_SECRET_KEY: 'sk_legacy_123',
    });

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/checkout/sessions',
      headers: { 'Idempotency-Key': 'checkout-legacy-key' },
      body: {
        referenceId: 'order-legacy',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        lineItems: [{ name: 'Starter Plan', quantity: 1, amount: { value: 99900, currency: 'PHP' } }],
      },
    });

    expect(response.status).toBe(500);
    expect(response.body.error?.message).toContain('PAYMONGO_TEST_SECRET_KEY is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects the legacy single PayMongo webhook secret', async () => {
    const app = loadPayMongoGateway({
      PAYMENT_PROVIDER_MODE: 'test',
      PAYMONGO_WEBHOOK_SECRET: 'legacy-webhook-secret',
    });
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    const timestamp = '1496734173';
    const signature = crypto
      .createHmac('sha256', 'legacy-webhook-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await requestApp<ApiBody>(app, {
      method: 'POST',
      path: '/webhooks',
      headers: { 'Paymongo-Signature': `t=${timestamp},te=${signature},li=` },
      body: payload,
    });

    expect(response.status).toBe(500);
    expect(response.body.error?.message).toContain('PAYMONGO_TEST_WEBHOOK_SECRET is required');
  });
});

function webhookPayload(overrides: {
  eventId?: string;
  eventType?: string;
  checkoutId?: string;
  providerData?: Record<string, unknown>;
} = {}) {
  return {
    data: {
      id: overrides.eventId || 'evt_test',
      type: 'event',
      attributes: {
        type: overrides.eventType || 'checkout_session.payment.paid',
        livemode: false,
        data: overrides.providerData || {
          id: overrides.checkoutId || 'cs_test',
          type: 'checkout_session',
        },
      },
    },
  };
}
