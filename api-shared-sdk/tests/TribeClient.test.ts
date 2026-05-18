import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthorizationError } from '../src/errors';
import { TribeClient } from '../src/TribeClient';

interface SharedServiceContract {
  sharedServices: Array<{ wrappers?: string[] }>;
  kafkaGovernance?: { wrappers?: string[] };
}

interface RecordedRequest {
  url?: string;
  method?: string;
  data?: unknown;
}

function loadContract(): SharedServiceContract {
  return JSON.parse(
    readFileSync(join(__dirname, '..', 'contracts', 'shared-service-contract.json'), 'utf8'),
  ) as SharedServiceContract;
}

function createAuthenticatedClient() {
  const client = new TribeClient({
    gatewayUrl: 'http://gateway.local',
    tribeId: 'orders-service',
    secret: 'secret',
    maxRetries: 0,
  });

  const post = vi.fn().mockResolvedValue({
    data: {
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
    },
  });

  const request = vi.fn().mockResolvedValue({
    data: {
      success: true,
      data: {
        ok: true,
      },
    },
  });

  (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
    post,
    request,
  };

  return { client, request };
}

async function expectWrapperRoute(
  action: (client: TribeClient) => Promise<unknown>,
  expected: RecordedRequest,
) {
  const { client, request } = createAuthenticatedClient();

  await action(client);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      url: expected.url,
      method: expected.method,
      ...(expected.data === undefined ? {} : { data: expected.data }),
    }),
  );
}

describe('TribeClient', () => {
  it('should normalize tenant topic names', () => {
    const topic = TribeClient.buildTenantTopic('Orders Service', 'Domain Events');

    expect(topic).toBe('tribe.orders-service.domain-events');
  });

  it('should proxy tribe calls after automatic authentication', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: { ok: true },
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    const response = await client.callService<{ ok: boolean }>('user-service', '/users/123');

    expect(response).toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith('/api/v1/auth/token', {
      tribeId: 'orders-service',
      secret: 'secret',
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/tribes/user-service/users/123',
        method: 'GET',
      }),
    );
  });

  it('should map 403 upstream errors to AuthorizationError', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockRejectedValue({
      isAxiosError: true,
      message: 'Forbidden',
      response: {
        status: 403,
        data: {
          message: 'Forbidden',
        },
        headers: {},
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    await expect(client.callService('user-service', '/users/123')).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it('should call payment checkout endpoint through shared services namespace', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          checkoutId: 'chk_123',
          provider: 'mock',
          status: 'pending',
          referenceId: 'order-123',
          redirectUrl: 'https://checkout.example.com/chk_123',
        },
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    await client.paymentCreateCheckoutSession({
      referenceId: 'order-123',
      idempotencyKey: 'checkout-order-123',
      successUrl: 'https://app.example.com/payment/success',
      cancelUrl: 'https://app.example.com/payment/cancel',
      lineItems: [
        {
          name: 'Starter Plan',
          quantity: 1,
          amount: {
            value: 99900,
            currency: 'PHP',
          },
        },
      ],
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/shared/payment/checkout/sessions',
        method: 'POST',
        data: expect.objectContaining({
          idempotencyKey: 'checkout-order-123',
        }),
      }),
    );
  });

  it('should call payment refund endpoint through shared services namespace', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          refundId: 'rf_123',
          paymentId: 'pay_123',
          provider: 'mock',
          status: 'pending',
          amount: { value: 5000, currency: 'PHP' },
        },
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    await client.paymentCreateRefund('pay_123', {
      amount: { value: 5000, currency: 'PHP' },
      reason: 'customer_request',
      idempotencyKey: 'refund-pay-123',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/shared/payment/payments/pay_123/refunds',
        method: 'POST',
        data: expect.objectContaining({
          idempotencyKey: 'refund-pay-123',
        }),
      }),
    );
  });

  it('should call payment checkout status endpoint through shared services namespace', async () => {
    await expectWrapperRoute(
      (client) => client.paymentGetCheckoutStatus('chk_123'),
      {
        url: '/api/v1/shared/payment/checkout/sessions/chk_123/status',
        method: 'GET',
      },
    );
  });

  it('should call payment checkout reference status endpoint through shared services namespace', async () => {
    await expectWrapperRoute(
      (client) => client.paymentGetCheckoutStatusByReference('order_123'),
      {
        url: '/api/v1/shared/payment/checkout/sessions/by-reference/order_123/status',
        method: 'GET',
      },
    );
  });

  it('should call payment checkout cancellation endpoint through shared services namespace', async () => {
    await expectWrapperRoute(
      (client) => client.paymentMarkCheckoutCancelled('chk_123', {
        reason: 'user_returned_from_cancel_url',
      }),
      {
        url: '/api/v1/shared/payment/checkout/sessions/chk_123/cancelled',
        method: 'POST',
        data: {
          reason: 'user_returned_from_cancel_url',
        },
      },
    );
  });

  it('should call payment customer endpoints through shared services namespace', async () => {
    await expectWrapperRoute(
      (client) => client.paymentCreateCustomer({
        email: 'buyer@example.com',
        name: 'Buyer Example',
      }),
      {
        url: '/api/v1/shared/payment/customers',
        method: 'POST',
        data: {
          email: 'buyer@example.com',
          name: 'Buyer Example',
        },
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentGetCustomer('cus_123'),
      {
        url: '/api/v1/shared/payment/customers/cus_123',
        method: 'GET',
      },
    );
  });

  it('should call payment catalog endpoints through shared services namespace', async () => {
    await expectWrapperRoute(
      (client) => client.paymentCreateProduct({
        name: 'Basic Membership',
        description: 'Monthly access',
      }),
      {
        url: '/api/v1/shared/payment/products',
        method: 'POST',
        data: {
          name: 'Basic Membership',
          description: 'Monthly access',
        },
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentGetProduct('prod_123'),
      {
        url: '/api/v1/shared/payment/products/prod_123',
        method: 'GET',
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentCreatePrice({
        productId: 'prod_123',
        amount: { value: 9900, currency: 'PHP' },
        recurring: { interval: 'month', intervalCount: 1 },
      }),
      {
        url: '/api/v1/shared/payment/prices',
        method: 'POST',
        data: {
          productId: 'prod_123',
          amount: { value: 9900, currency: 'PHP' },
          recurring: { interval: 'month', intervalCount: 1 },
        },
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentGetPrice('price_123'),
      {
        url: '/api/v1/shared/payment/prices/price_123',
        method: 'GET',
      },
    );
  });

  it('should call payment subscription endpoints through shared services namespace', async () => {
    const payload = {
      referenceId: 'church_123_basic',
      customerId: 'cus_123',
      priceId: 'price_123',
      idempotencyKey: 'sub-church-123-basic',
    };

    await expectWrapperRoute(
      (client) => client.paymentCreateSubscription(payload),
      {
        url: '/api/v1/shared/payment/subscriptions',
        method: 'POST',
        data: payload,
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentGetSubscription('sub_123'),
      {
        url: '/api/v1/shared/payment/subscriptions/sub_123',
        method: 'GET',
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentGetSubscriptionByReference('church_123_basic'),
      {
        url: '/api/v1/shared/payment/subscriptions/by-reference/church_123_basic',
        method: 'GET',
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentCancelSubscription('sub_123', {
        cancelAtPeriodEnd: true,
        reason: 'customer_request',
      }),
      {
        url: '/api/v1/shared/payment/subscriptions/sub_123/cancel',
        method: 'POST',
        data: {
          cancelAtPeriodEnd: true,
          reason: 'customer_request',
        },
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentPauseSubscription('sub_123', {
        reason: 'customer_request',
      }),
      {
        url: '/api/v1/shared/payment/subscriptions/sub_123/pause',
        method: 'POST',
        data: {
          reason: 'customer_request',
        },
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentResumeSubscription('sub_123'),
      {
        url: '/api/v1/shared/payment/subscriptions/sub_123/resume',
        method: 'POST',
        data: {},
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentChangeSubscriptionPrice('sub_123', {
        priceId: 'price_456',
      }),
      {
        url: '/api/v1/shared/payment/subscriptions/sub_123/change-price',
        method: 'POST',
        data: {
          priceId: 'price_456',
        },
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentListSubscriptionInvoices('sub_123'),
      {
        url: '/api/v1/shared/payment/subscriptions/sub_123/invoices',
        method: 'GET',
      },
    );

    await expectWrapperRoute(
      (client) => client.paymentGetInvoice('inv_123'),
      {
        url: '/api/v1/shared/payment/invoices/inv_123',
        method: 'GET',
      },
    );
  });

  it('should call email send endpoint through shared services namespace', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          messageId: 'msg_123',
          provider: 'mock',
          status: 'queued',
        },
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    await client.emailSend({
      to: [{ email: 'user@example.com' }],
      subject: 'Receipt',
      text: 'Thanks for your order',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/shared/email/send',
        method: 'POST',
      }),
    );
  });

  it('should call sms status endpoint through shared services namespace', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          messageId: 'sms_123',
          provider: 'mock',
          status: 'delivered',
        },
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    await client.smsGetStatus('sms_123');

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/shared/sms/status/sms_123',
        method: 'GET',
      }),
    );
  });

  it('should call Google OAuth token exchange endpoint through shared services namespace', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          accessToken: 'google-access-token',
          refreshToken: 'google-refresh-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    await client.gauthExchangeCode({
      code: 'authorization-code',
      redirectUri: 'http://localhost:5173/auth/google/callback',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/shared/gauth/oauth/token',
        method: 'POST',
      }),
    );
  });

  it('should call governed Kafka publish endpoint through AP Center governance API', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          topic: 'tribe.orders-service.events',
          eventType: 'order.created',
          accepted: true,
        },
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    await client.kafkaPublish({
      topic: 'tribe.orders-service.events',
      eventType: 'order.created',
      payload: { orderId: 'ord_123' },
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/kafka/publish',
        method: 'POST',
      }),
    );
  });

  it('should merge tribe and shared service discovery results', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockImplementation((config: { url: string }) => {
      if (config.url === '/api/v1/tribes') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                serviceId: 'user-service',
                name: 'User Service',
                status: 'active',
                exposes: ['/users'],
                serviceType: 'tribe',
                canAccess: true,
              },
            ],
          },
        });
      }

      if (config.url === '/api/v1/shared') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                serviceId: 'email-service',
                name: 'Email Service',
                status: 'active',
                exposes: ['/send'],
                serviceType: 'shared',
                canAccess: true,
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    const services = await client.listAllServices();

    expect(services.map((service) => service.serviceId)).toEqual(['user-service', 'email-service']);
  });

  it('should parse service scope catalog', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          platformScopes: ['platform:admin'],
          externalScopes: ['external:weather:read'],
          dynamicServiceScopes: ['users:read'],
          allScopes: ['external:weather:read', 'platform:admin', 'users:read'],
        },
      },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    const catalog = await client.getServiceScopes();

    expect(catalog.allScopes).toEqual(['external:weather:read', 'platform:admin', 'users:read']);
  });

  it('should derive service scopes when registry scopes endpoint is forbidden', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        },
      },
    });

    const request = vi.fn().mockImplementation((config: { url: string }) => {
      if (config.url === '/api/v1/registry/scopes') {
        return Promise.reject({
          isAxiosError: true,
          message: 'Forbidden',
          response: {
            status: 403,
            data: { message: 'Forbidden' },
            headers: {},
          },
        });
      }

      if (config.url === '/api/v1/tribes') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                serviceId: 'user-service',
                name: 'User Service',
                status: 'active',
                exposes: ['/users'],
                requiredScopes: ['users:read'],
                serviceType: 'tribe',
                canAccess: true,
              },
            ],
          },
        });
      }

      if (config.url === '/api/v1/shared') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                serviceId: 'email-service',
                name: 'Email Service',
                status: 'active',
                exposes: ['/send'],
                requiredScopes: ['messages:send'],
                serviceType: 'shared',
                canAccess: true,
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = {
      post,
      request,
    };

    const catalog = await client.getServiceScopes();

    expect(catalog.allScopes).toEqual(['messages:send', 'users:read']);
  });

  it('should call geo geocode endpoint through shared services namespace', async () => {
    const payload = { address: 'Manila, Philippines' };

    await expectWrapperRoute(
      (client) => client.geoGeocodeAddress(payload),
      {
        url: '/api/v1/shared/geo/geocode',
        method: 'POST',
        data: payload,
      },
    );
  });

  it('should call geo reverse-geocode endpoint through shared services namespace', async () => {
    const payload = { latitude: 14.5995, longitude: 120.9842 };

    await expectWrapperRoute(
      (client) => client.geoReverseGeocode(payload),
      {
        url: '/api/v1/shared/geo/reverse-geocode',
        method: 'POST',
        data: payload,
      },
    );
  });

  it('should call geo geofence check endpoint through shared services namespace', async () => {
    const client = new TribeClient({
      gatewayUrl: 'http://gateway.local',
      tribeId: 'orders-service',
      secret: 'secret',
    });

    const post = vi.fn().mockResolvedValue({ data: { data: { accessToken: 'token' } } });
    const request = vi.fn().mockResolvedValue({
      data: { success: true, data: { inside: true, distanceDetails: [] } },
    });

    (client as unknown as { http: { post: typeof post; request: typeof request } }).http = { post, request };

    const result = await client.geoFenceCheck({ latitude: 14.5995, longitude: 120.9842 });
    
    expect(result).toEqual({ inside: true, distanceDetails: [] });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/shared/geo/geofence/check',
        method: 'POST',
        data: { latitude: 14.5995, longitude: 120.9842 }
      })
    );
  });

  it('should expose every wrapper declared by the shared-service contract', () => {
    const contract = loadContract();
    const wrappers = [
      ...contract.sharedServices.flatMap((service) => service.wrappers ?? []),
      ...(contract.kafkaGovernance?.wrappers ?? []),
    ];

    for (const wrapper of wrappers) {
      expect(TribeClient.prototype).toHaveProperty(wrapper);
      expect(typeof (TribeClient.prototype as unknown as Record<string, unknown>)[wrapper]).toBe(
        'function',
      );
    }
  });

  it('should call payment checkout lookup endpoint through shared services namespace', async () => {
    await expectWrapperRoute(
      (client) => client.paymentGetCheckoutSession('chk_123'),
      {
        url: '/api/v1/shared/payment/checkout/sessions/chk_123',
        method: 'GET',
      },
    );
  });

  it('should call email status endpoint through shared services namespace', async () => {
    await expectWrapperRoute(
      (client) => client.emailGetStatus('msg_123'),
      {
        url: '/api/v1/shared/email/status/msg_123',
        method: 'GET',
      },
    );
  });

  it('should call sms send endpoint through shared services namespace', async () => {
    const payload = { to: '+639171234567', message: 'Hello from AP Center' };

    await expectWrapperRoute(
      (client) => client.smsSend(payload),
      {
        url: '/api/v1/shared/sms/send',
        method: 'POST',
        data: payload,
      },
    );
  });

  it('should call Google OAuth authorization endpoint through shared services namespace', async () => {
    const payload = { redirectUri: 'https://app.example.com/oauth/callback' };

    await expectWrapperRoute(
      (client) => client.gauthGetAuthorizationUrl(payload),
      {
        url: '/api/v1/shared/gauth/oauth/authorize',
        method: 'POST',
        data: payload,
      },
    );
  });

  it('should call Google OAuth refresh endpoint through shared services namespace', async () => {
    const payload = { refreshToken: 'google-refresh-token' };

    await expectWrapperRoute(
      (client) => client.gauthRefreshToken(payload),
      {
        url: '/api/v1/shared/gauth/oauth/token/refresh',
        method: 'POST',
        data: payload,
      },
    );
  });

  it('should call Google OAuth logout endpoint through shared services namespace', async () => {
    const payload = { refreshToken: 'google-refresh-token' };

    await expectWrapperRoute(
      (client) => client.gauthLogout(payload),
      {
        url: '/api/v1/shared/gauth/oauth/logout',
        method: 'POST',
        data: payload,
      },
    );
  });

  it('should call OTP generate endpoint through shared services namespace', async () => {
    const payload = { target: '+639171234567', channel: 'sms' as const };

    await expectWrapperRoute(
      (client) => client.otpGenerate(payload),
      {
        url: '/api/v1/shared/otp/generate',
        method: 'POST',
        data: payload,
      },
    );
  });

  it('should call OTP verify endpoint through shared services namespace', async () => {
    const payload = { otpId: 'otp_123', code: '123456' };

    await expectWrapperRoute(
      (client) => client.otpVerify(payload),
      {
        url: '/api/v1/shared/otp/verify',
        method: 'POST',
        data: payload,
      },
    );
  });

  it('should call OTP status endpoint through shared services namespace', async () => {
    await expectWrapperRoute(
      (client) => client.otpStatus('otp_123'),
      {
        url: '/api/v1/shared/otp/status/otp_123',
        method: 'GET',
      },
    );
  });

  it('should call governed Kafka catalog endpoint through AP Center governance API', async () => {
    await expectWrapperRoute(
      (client) => client.kafkaGetGovernanceCatalog(),
      {
        url: '/api/v1/kafka/governance',
        method: 'GET',
      },
    );
  });
});
