import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const repoRoot = join(__dirname, '..', '..');
const {
  CANONICAL_PAYMENT_STATUSES,
  createDisabledPaymentStore,
  createMemoryPaymentStore,
  createPaymentStore,
} = require(join(repoRoot, 'shared-services/paymongo/src/services/paymongo/paymentStore.js'));

describe('PayMongo payment store', () => {
  it('skips persistence when disabled', async () => {
    const store = createDisabledPaymentStore();

    await expect(store.createCheckoutSessionRecord({
      checkoutId: 'cs_disabled',
      tribeId: 'servease',
      referenceId: 'order-disabled',
      status: 'created',
    })).resolves.toBeNull();

    await expect(store.getCheckoutSessionStatus('cs_disabled')).resolves.toBeNull();
    await expect(store.updateCheckoutStatus('cs_disabled', { status: 'paid' })).resolves.toBeNull();
    await expect(store.recordWebhookEvent({ eventId: 'evt_disabled' })).resolves.toEqual({
      inserted: true,
      duplicate: false,
      disabled: true,
    });
  });

  it('requires a database URL when database mode is enabled', () => {
    expect(() =>
      createPaymentStore({
        SHARED_SERVICES_DATABASE_ENABLED: 'true',
      }),
    ).toThrow('SHARED_SERVICES_DATABASE_URL is required when SHARED_SERVICES_DATABASE_ENABLED=true.');
  });

  it('records webhook events idempotently in memory mode', async () => {
    const store = createMemoryPaymentStore();

    await expect(store.recordWebhookEvent({
      eventId: 'evt_once',
      eventType: 'checkout_session.payment.paid',
      checkoutId: 'cs_once',
    })).resolves.toMatchObject({
      inserted: true,
      duplicate: false,
    });

    await expect(store.recordWebhookEvent({
      eventId: 'evt_once',
      eventType: 'checkout_session.payment.paid',
      checkoutId: 'cs_once',
    })).resolves.toMatchObject({
      inserted: false,
      duplicate: true,
    });
  });

  it('stores and updates checkout sessions in memory mode', async () => {
    const store = createMemoryPaymentStore();
    const entry = {
      checkoutId: 'cs_memory',
      tribeId: 'servease',
      referenceId: 'order-memory',
      status: 'created',
      amount: { value: 10000, currency: 'PHP' },
      provider: 'paymongo',
      providerMode: 'test',
      successUrl: 'https://servease.test/success',
      cancelUrl: 'https://servease.test/cancel',
      metadata: { orderId: 'order-memory' },
    };

    await store.createCheckoutSessionRecord(entry);
    expect(await store.getCheckoutSessionStatus('cs_memory')).toMatchObject(entry);

    await store.updateCheckoutStatus('cs_memory', {
      status: 'cancelled',
      cancellationReason: 'user_returned_from_cancel_url',
    });

    expect(await store.getCheckoutSessionStatus('cs_memory')).toMatchObject({
      checkoutId: 'cs_memory',
      status: 'cancelled',
      cancellationReason: 'user_returned_from_cancel_url',
    });
    expect(await store.getCheckoutSessionByReference('order-memory', 'servease')).toMatchObject({
      checkoutId: 'cs_memory',
      referenceId: 'order-memory',
    });
  });

  it('rejects non-canonical checkout statuses', async () => {
    const store = createMemoryPaymentStore();

    expect(CANONICAL_PAYMENT_STATUSES).toContain('cancelled');
    await expect(store.updateCheckoutStatus('cs_bad', { status: 'voided' })).rejects.toThrow(
      'Unsupported payment status: voided.',
    );
  });

  it('stores catalog and customer records in memory mode', async () => {
    const store = createMemoryPaymentStore();

    await expect(store.createCustomer({
      customerId: 'cus_memory',
      tribeId: 'servease',
      provider: 'paymongo',
      providerMode: 'test',
      email: 'customer@example.com',
      name: 'Customer Example',
      metadata: { profileId: 'profile_123' },
    })).resolves.toMatchObject({
      customerId: 'cus_memory',
      tribeId: 'servease',
      email: 'customer@example.com',
    });

    await expect(store.createProduct({
      productId: 'prod_memory',
      tribeId: 'servease',
      name: 'Basic Membership',
      description: 'Monthly access',
      active: true,
    })).resolves.toMatchObject({
      productId: 'prod_memory',
      tribeId: 'servease',
      active: true,
    });

    await expect(store.createPrice({
      priceId: 'price_memory',
      tribeId: 'servease',
      productId: 'prod_memory',
      amount: { value: 9900, currency: 'PHP' },
      recurring: { interval: 'month', intervalCount: 1 },
      active: true,
    })).resolves.toMatchObject({
      priceId: 'price_memory',
      productId: 'prod_memory',
      amount: { value: 9900, currency: 'PHP' },
      recurring: { interval: 'month', intervalCount: 1 },
    });

    await expect(store.getCustomer('cus_memory', 'servease')).resolves.toMatchObject({
      customerId: 'cus_memory',
    });
    await expect(store.getCustomer('cus_memory', 'other-tribe')).resolves.toBeNull();
    await expect(store.getProduct('prod_memory', 'servease')).resolves.toMatchObject({
      productId: 'prod_memory',
    });
    await expect(store.getPrice('price_memory', 'servease')).resolves.toMatchObject({
      priceId: 'price_memory',
    });
  });

  it('stores subscriptions and invoices in memory mode with tenant-scoped lookup', async () => {
    const store = createMemoryPaymentStore();

    await store.createSubscription({
      subscriptionId: 'sub_memory',
      tribeId: 'servease',
      provider: 'paymongo',
      providerMode: 'test',
      referenceId: 'church_123_basic',
      customerId: 'cus_memory',
      priceId: 'price_memory',
      status: 'active',
      currentPeriodStart: '2026-05-17T00:00:00.000Z',
      currentPeriodEnd: '2026-06-17T00:00:00.000Z',
      cancelAtPeriodEnd: false,
    });

    await expect(store.getSubscription('sub_memory', 'servease')).resolves.toMatchObject({
      subscriptionId: 'sub_memory',
      status: 'active',
    });
    await expect(store.getSubscriptionByReference('church_123_basic', 'servease')).resolves.toMatchObject({
      subscriptionId: 'sub_memory',
    });
    await expect(store.getSubscriptionByReference('church_123_basic', 'other-tribe')).resolves.toBeNull();

    await store.updateSubscriptionStatus('sub_memory', {
      status: 'cancelled',
      cancelAtPeriodEnd: true,
    });
    await expect(store.getSubscription('sub_memory', 'servease')).resolves.toMatchObject({
      status: 'cancelled',
      cancelAtPeriodEnd: true,
    });

    await store.createInvoice({
      invoiceId: 'inv_memory',
      tribeId: 'servease',
      subscriptionId: 'sub_memory',
      customerId: 'cus_memory',
      status: 'open',
      amountDue: { value: 9900, currency: 'PHP' },
    });

    await expect(store.getInvoice('inv_memory', 'servease')).resolves.toMatchObject({
      invoiceId: 'inv_memory',
      subscriptionId: 'sub_memory',
      amountDue: { value: 9900, currency: 'PHP' },
    });
    await expect(store.listInvoicesForSubscription('sub_memory', 'servease')).resolves.toHaveLength(1);
  });

  it('records subscription events idempotently in memory mode', async () => {
    const store = createMemoryPaymentStore();

    await expect(store.recordSubscriptionEvent({
      provider: 'paymongo',
      providerMode: 'test',
      providerEventId: 'evt_sub_once',
      subscriptionId: 'sub_memory',
      eventType: 'payment.subscription.active',
      status: 'processed',
    })).resolves.toMatchObject({
      inserted: true,
      duplicate: false,
    });

    await expect(store.recordSubscriptionEvent({
      provider: 'paymongo',
      providerMode: 'test',
      providerEventId: 'evt_sub_once',
      subscriptionId: 'sub_memory',
      eventType: 'payment.subscription.active',
      status: 'processed',
    })).resolves.toMatchObject({
      inserted: false,
      duplicate: true,
    });
  });
});
