#!/usr/bin/env node

const {
  createPaymentSubscriptionSmokeClient,
  runPaymentSubscriptionSmoke,
} = require('../dist');

async function main() {
  const gatewayUrl = requiredEnv('APICENTER_GATEWAY_URL').replace(/\/$/, '');
  const tribeId = requiredEnv('APICENTER_TRIBE_ID');
  const secret = requiredEnv('APICENTER_TRIBE_SECRET');

  const client = createPaymentSubscriptionSmokeClient({
    gatewayUrl,
    tribeId,
    secret,
    timeout: Number(process.env.APICENTER_SMOKE_TIMEOUT_MS || 30000),
  });

  const result = await runPaymentSubscriptionSmoke({
    client,
    ids: {
      customerId: process.env.PAYMENT_SMOKE_CUSTOMER_ID,
      productId: process.env.PAYMENT_SMOKE_PRODUCT_ID,
      priceId: process.env.PAYMENT_SMOKE_PRICE_ID,
      subscriptionId: process.env.PAYMENT_SMOKE_SUBSCRIPTION_ID,
      referenceId: process.env.PAYMENT_SMOKE_REFERENCE_ID,
    },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('SDK payment subscription smoke failed:', error.message);
  process.exit(1);
});
