import { describe, expect, it, vi } from 'vitest';

import {
  runPaymentSubscriptionSmoke,
  type PaymentSubscriptionSmokeClient,
} from '../src/smoke/paymentSubscriptionSmoke';

describe('runPaymentSubscriptionSmoke', () => {
  it('uses TribeClient payment subscription helpers in SDK order', async () => {
    const calls: string[] = [];
    const client: PaymentSubscriptionSmokeClient = {
      authenticate: vi.fn(async () => {
        calls.push('authenticate');
      }),
      paymentCreateCustomer: vi.fn(async (payload) => {
        calls.push(`customer:${payload.customerId}`);
        return {
          customerId: payload.customerId ?? 'cus_smoke',
          provider: 'paymongo',
          providerMode: 'test',
        };
      }),
      paymentCreateProduct: vi.fn(async (payload) => {
        calls.push(`product:${payload.productId}`);
        return {
          productId: payload.productId ?? 'prod_smoke',
          name: payload.name,
          active: true,
          provider: 'paymongo',
        };
      }),
      paymentCreatePrice: vi.fn(async (payload) => {
        calls.push(`price:${payload.priceId}`);
        return {
          priceId: payload.priceId ?? 'price_smoke',
          productId: payload.productId,
          amount: payload.amount,
          recurring: payload.recurring,
          active: true,
          provider: 'paymongo',
        };
      }),
      paymentCreateSubscription: vi.fn(async (payload) => {
        calls.push(`subscription:${payload.subscriptionId}`);
        return {
          subscriptionId: payload.subscriptionId ?? 'sub_smoke',
          referenceId: payload.referenceId,
          customerId: payload.customerId,
          priceId: payload.priceId,
          status: 'active',
          provider: 'paymongo',
          providerMode: 'test',
          cancelAtPeriodEnd: false,
        };
      }),
      paymentGetSubscription: vi.fn(async (subscriptionId) => {
        calls.push(`get:${subscriptionId}`);
        return {
          subscriptionId,
          referenceId: 'sdk-smoke-reference',
          customerId: 'cus_sdk_smoke',
          priceId: 'price_sdk_smoke',
          status: 'active',
          provider: 'paymongo',
          providerMode: 'test',
          cancelAtPeriodEnd: false,
        };
      }),
      paymentCancelSubscription: vi.fn(async (subscriptionId, payload) => {
        calls.push(`cancel:${subscriptionId}:${payload.cancelAtPeriodEnd}`);
        return {
          subscriptionId,
          referenceId: 'sdk-smoke-reference',
          customerId: 'cus_sdk_smoke',
          priceId: 'price_sdk_smoke',
          status: 'cancelled',
          provider: 'paymongo',
          providerMode: 'test',
          cancelAtPeriodEnd: false,
        };
      }),
    };

    const result = await runPaymentSubscriptionSmoke({
      client,
      ids: {
        customerId: 'cus_sdk_smoke',
        productId: 'prod_sdk_smoke',
        priceId: 'price_sdk_smoke',
        subscriptionId: 'sub_sdk_smoke',
        referenceId: 'sdk-smoke-reference',
      },
    });

    expect(calls).toEqual([
      'authenticate',
      'customer:cus_sdk_smoke',
      'product:prod_sdk_smoke',
      'price:price_sdk_smoke',
      'subscription:sub_sdk_smoke',
      'get:sub_sdk_smoke',
      'cancel:sub_sdk_smoke:false',
      'get:sub_sdk_smoke',
    ]);
    expect(result.subscriptionStatus).toBe('active');
    expect(result.cancelStatus).toBe('cancelled');
    expect(result.providerMode).toBe('test');
  });
});
