import { TribeClient } from '../TribeClient';

export type PaymentSubscriptionSmokeIds = {
  customerId: string;
  productId: string;
  priceId: string;
  subscriptionId: string;
  referenceId: string;
};

export type PaymentSubscriptionSmokeClient = Pick<
  TribeClient,
  | 'authenticate'
  | 'paymentCreateCustomer'
  | 'paymentCreateProduct'
  | 'paymentCreatePrice'
  | 'paymentCreateSubscription'
  | 'paymentGetSubscription'
  | 'paymentCancelSubscription'
>;

export type PaymentSubscriptionSmokeOptions = {
  client: PaymentSubscriptionSmokeClient;
  ids?: Partial<PaymentSubscriptionSmokeIds>;
};

export type PaymentSubscriptionSmokeResult = {
  ids: PaymentSubscriptionSmokeIds;
  customerId: string;
  productId: string;
  priceId: string;
  subscriptionId: string;
  subscriptionStatus: string;
  cancelStatus: string;
  provider?: string;
  providerMode?: string;
};

export async function runPaymentSubscriptionSmoke(
  options: PaymentSubscriptionSmokeOptions,
): Promise<PaymentSubscriptionSmokeResult> {
  const ids = resolveSmokeIds(options.ids);
  const client = options.client;

  await client.authenticate();

  const customer = await client.paymentCreateCustomer({
    customerId: ids.customerId,
    email: 'sdk-smoke@example.com',
    name: 'SDK Smoke Customer',
    metadata: { source: 'sdk-payment-subscription-smoke' },
  });
  const product = await client.paymentCreateProduct({
    productId: ids.productId,
    name: 'SDK Smoke Subscription',
    metadata: { source: 'sdk-payment-subscription-smoke' },
  });
  const price = await client.paymentCreatePrice({
    priceId: ids.priceId,
    productId: product.productId,
    amount: { value: 10000, currency: 'PHP' },
    recurring: { interval: 'month', intervalCount: 1 },
    metadata: { source: 'sdk-payment-subscription-smoke' },
  });
  const subscription = await client.paymentCreateSubscription({
    subscriptionId: ids.subscriptionId,
    referenceId: ids.referenceId,
    idempotencyKey: ids.referenceId,
    customerId: customer.customerId,
    priceId: price.priceId,
    metadata: { source: 'sdk-payment-subscription-smoke' },
  });
  const readBack = await client.paymentGetSubscription(subscription.subscriptionId);
  const cancelled = await client.paymentCancelSubscription(subscription.subscriptionId, {
    cancelAtPeriodEnd: false,
    reason: 'sdk_smoke_cleanup',
  });
  await client.paymentGetSubscription(subscription.subscriptionId);

  return {
    ids,
    customerId: customer.customerId,
    productId: product.productId,
    priceId: price.priceId,
    subscriptionId: subscription.subscriptionId,
    subscriptionStatus: readBack.status,
    cancelStatus: cancelled.status,
    provider: firstDefined(subscription.provider, cancelled.provider, customer.provider),
    providerMode: firstDefined(
      subscription.providerMode,
      cancelled.providerMode,
      customer.providerMode,
    ),
  };
}

export function createPaymentSubscriptionSmokeClient(options: {
  gatewayUrl: string;
  tribeId: string;
  secret: string;
  timeout?: number;
}): TribeClient {
  return new TribeClient({
    gatewayUrl: options.gatewayUrl,
    tribeId: options.tribeId,
    secret: options.secret,
    timeout: options.timeout,
    maxRetries: 0,
  });
}

function resolveSmokeIds(
  ids: Partial<PaymentSubscriptionSmokeIds> | undefined,
): PaymentSubscriptionSmokeIds {
  const suffix = Date.now().toString();
  return {
    customerId: ids?.customerId ?? `cus_sdk_smoke_${suffix}`,
    productId: ids?.productId ?? `prod_sdk_smoke_${suffix}`,
    priceId: ids?.priceId ?? `price_sdk_smoke_${suffix}`,
    subscriptionId: ids?.subscriptionId ?? `sub_sdk_smoke_${suffix}`,
    referenceId: ids?.referenceId ?? `sdk-smoke-subscription-${suffix}`,
  };
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}
