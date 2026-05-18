const crypto = require('node:crypto');
const {
  extractPaymentFromCheckoutSession,
  extractPayMongoEvent,
} = require('./paymentEvents');
const {
  getPaymentStore,
  isPaymentStoreEnabled,
} = require('./paymentStore');

const PAYMONGO_BASE_URL = process.env.PAYMONGO_BASE_URL || 'https://api.paymongo.com/v1';
const DEFAULT_SUPPORTED_PAYMENT_METHODS = [
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
];

const PAYMENT_METHOD_ALIASES = {
  qr: ['qrph'],
  qrph: ['qrph'],
  'qr-ph': ['qrph'],
  gcash: ['gcash'],
  grabpay: ['grab_pay'],
  grab_pay: ['grab_pay'],
  maya: ['paymaya'],
  paymaya: ['paymaya'],
  card: ['card'],
  cards: ['card'],
  visa: ['card'],
  mastercard: ['card'],
  master_card: ['card'],
  'visa_mastercard': ['card'],
  'visa-mastercard': ['card'],
  dob: ['dob'],
  direct_online_banking: ['dob', 'dob_ubp', 'brankas_bdo', 'brankas_landbank', 'brankas_metrobank'],
  online_banking: ['dob', 'dob_ubp', 'brankas_bdo', 'brankas_landbank', 'brankas_metrobank'],
  brankas: ['brankas_bdo', 'brankas_landbank', 'brankas_metrobank'],
  dob_ubp: ['dob_ubp'],
  brankas_bdo: ['brankas_bdo'],
  brankas_landbank: ['brankas_landbank'],
  brankas_metrobank: ['brankas_metrobank'],
};

class PayMongoError extends Error {
  constructor(message, statusCode = 502, details) {
    super(message);
    this.name = 'PayMongoError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = details?.code;
  }
}

function providerDisabledError(feature = 'Subscriptions') {
  return new PayMongoError(
    `${feature} wrapper is not enabled. Set PAYMENT_SUBSCRIPTIONS_ENABLED=true after PayMongo subscription integration is verified.`,
    501,
    { code: 'SUBSCRIPTIONS_DISABLED' },
  );
}

function subscriptionsEnabled() {
  return process.env.PAYMENT_SUBSCRIPTIONS_ENABLED === 'true';
}

function catalogDisabledError(feature = 'Payment catalog') {
  return new PayMongoError(
    `${feature} requires SHARED_SERVICES_DATABASE_ENABLED=true.`,
    501,
    { code: 'PAYMENT_CATALOG_DISABLED' },
  );
}

function notFoundError(resource, id) {
  return new PayMongoError(`${resource} '${id}' was not found.`, 404, {
    code: 'NOT_FOUND',
  });
}

function conflictError(message) {
  return new PayMongoError(message, 409, { code: 'CONFLICT' });
}

function hashIdempotencyKey(idempotencyKey) {
  return crypto
    .createHash('sha256')
    .update(String(idempotencyKey))
    .digest('hex');
}

function isMockMode() {
  if (process.env.PAYMENT_PROVIDER_MODE === 'mock') {
    return true;
  }

  return !process.env.PAYMENT_PROVIDER_MODE
    && !resolveSecretKey()
    && process.env.NODE_ENV !== 'production';
}

function providerMode() {
  return process.env.PAYMENT_PROVIDER_MODE === 'live' ? 'live' : 'test';
}

function resolveSecretKey() {
  if (providerMode() === 'live') {
    return process.env.PAYMONGO_LIVE_SECRET_KEY;
  }

  return process.env.PAYMONGO_TEST_SECRET_KEY;
}

function requireSecretKey() {
  const secretKey = resolveSecretKey();
  if (!secretKey) {
    const mode = providerMode();
    const expectedKey = mode === 'live' ? 'PAYMONGO_LIVE_SECRET_KEY' : 'PAYMONGO_TEST_SECRET_KEY';
    throw new PayMongoError(`${expectedKey} is required for PayMongo ${mode} mode.`, 500);
  }

  return secretKey;
}

function basicAuthHeader(secretKey) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

function parsePaymentMethodList(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    return rawValue
      .split(',')
      .map((method) => method.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizePaymentMethodName(method) {
  return String(method || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function expandPaymentMethods(methods) {
  const expanded = [];

  for (const method of methods) {
    const normalized = normalizePaymentMethodName(method);
    const aliases = PAYMENT_METHOD_ALIASES[normalized];

    if (!aliases) {
      throw new PayMongoError(
        `Unsupported PayMongo payment method: ${method}.`,
        400,
        {
          supportedPaymentMethods: DEFAULT_SUPPORTED_PAYMENT_METHODS,
          aliases: Object.keys(PAYMENT_METHOD_ALIASES).sort(),
        },
      );
    }

    expanded.push(...aliases);
  }

  return [...new Set(expanded)];
}

function configuredAllowedPaymentMethods() {
  const configured = parsePaymentMethodList(process.env.PAYMONGO_ALLOWED_PAYMENT_METHODS);
  return configured.length > 0
    ? expandPaymentMethods(configured)
    : DEFAULT_SUPPORTED_PAYMENT_METHODS;
}

function configuredDefaultPaymentMethods(allowedMethods) {
  const configured = parsePaymentMethodList(process.env.PAYMONGO_DEFAULT_PAYMENT_METHODS);
  if (configured.length === 0) {
    return allowedMethods;
  }

  return expandPaymentMethods(configured);
}

function resolvePaymentMethods(chargeData = {}) {
  const allowedMethods = configuredAllowedPaymentMethods();
  const requestedMethods = parsePaymentMethodList(
    chargeData.paymentMethods || chargeData.paymentMethodTypes,
  );
  const selectedMethods = requestedMethods.length > 0
    ? expandPaymentMethods(requestedMethods)
    : configuredDefaultPaymentMethods(allowedMethods);
  const disallowedMethods = selectedMethods.filter((method) => !allowedMethods.includes(method));

  if (disallowedMethods.length > 0) {
    throw new PayMongoError(
      `PayMongo payment method is not enabled: ${disallowedMethods.join(', ')}.`,
      400,
      {
        disallowedPaymentMethods: disallowedMethods,
        allowedPaymentMethods: allowedMethods,
      },
    );
  }

  return selectedMethods;
}

async function paymongoRequest(path, { method = 'GET', body, idempotencyKey } = {}) {
  const response = await fetch(`${PAYMONGO_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: basicAuthHeader(requireSecretKey()),
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const providerMessage =
      responseBody?.errors?.[0]?.detail
      || responseBody?.errors?.[0]?.message
      || responseBody?.error
      || 'PayMongo provider request failed.';

    throw new PayMongoError(providerMessage, 502, responseBody);
  }

  return responseBody;
}

function normalizeAmount(amount, fallbackCurrency = 'PHP') {
  if (typeof amount === 'object' && amount !== null) {
    return {
      value: Number(amount.value),
      currency: amount.currency || fallbackCurrency,
    };
  }

  return {
    value: Number(amount),
    currency: fallbackCurrency,
  };
}

function normalizeLineItems(lineItems = []) {
  return lineItems.map((item) => {
    const amount = normalizeAmount(item.amount, item.currency || 'PHP');

    return {
      name: item.name,
      quantity: item.quantity || 1,
      amount: amount.value,
      currency: amount.currency,
      description: item.description,
      images: item.images,
    };
  });
}

function totalLineItemAmount(lineItems = []) {
  return normalizeLineItems(lineItems).reduce(
    (sum, item) => sum + Number(item.amount || 0) * Number(item.quantity || 1),
    0,
  );
}

function toCheckoutSession(providerResponse, request) {
  const providerData = providerResponse?.data || {};
  const attributes = providerData.attributes || {};
  const paymentMethodsAllowed =
    attributes.payment_method_types
    || attributes.payment_method_allowed
    || request.paymentMethodsAllowed;
  const amount = request.amount
    ? normalizeAmount(request.amount, request.currency || 'PHP')
    : {
      value: attributes.amount || totalLineItemAmount(request.lineItems),
      currency: attributes.currency || request.currency || 'PHP',
    };

  return {
    checkoutId: providerData.id || `mock_checkout_${crypto.randomUUID().replace(/-/g, '')}`,
    provider: 'paymongo',
    status: mapCheckoutStatus(attributes.status),
    referenceId: request.referenceId,
    redirectUrl: attributes.checkout_url || request.successUrl || 'https://checkout.paymongo.local/mock',
    expiresAt: attributes.expires_at ? new Date(attributes.expires_at * 1000).toISOString() : undefined,
    amount,
    paymentMethodsAllowed,
    metadata: request.metadata,
    providerData,
  };
}

function toRefund(providerResponse, request) {
  const providerData = providerResponse?.data || {};
  const attributes = providerData.attributes || {};
  const amount = normalizeAmount(request.amount, request.currency || attributes.currency || 'PHP');

  return {
    refundId: providerData.id || `mock_refund_${crypto.randomUUID().replace(/-/g, '')}`,
    paymentId: request.payment_id,
    provider: 'paymongo',
    status: attributes.status || 'succeeded',
    amount,
    reason: request.reason,
    referenceId: request.referenceId,
  };
}

function mapCheckoutStatus(status) {
  if (status === 'paid') {
    return 'paid';
  }

  if (status === 'expired') {
    return 'expired';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return 'pending';
}

async function charge(chargeData, options = {}) {
  if (chargeData.mode === 'subscription') {
    throw providerDisabledError('Subscription checkout');
  }

  const paymentMethodsAllowed = resolvePaymentMethods(chargeData);
  const store = getPaymentStore();
  const tribeId = options.tribeId || chargeData.tribeId;

  if (store.enabled && !tribeId) {
    throw new PayMongoError('A tribe context is required when payment persistence is enabled.', 400);
  }

  if (isMockMode()) {
    const session = toCheckoutSession(
      {
        data: {
          id: 'mock_checkout_001',
          attributes: {
            checkout_url: 'https://checkout.paymongo.local/mock_checkout_001',
            status: 'pending',
          },
        },
      },
      { ...chargeData, paymentMethodsAllowed },
    );

    await persistCheckoutSession(session, chargeData, {
      paymentMethodsAllowed,
      providerMetadata: { mock: true },
      tribeId,
    });

    return session;
  }

  const body = {
    data: {
      attributes: {
        line_items: normalizeLineItems(chargeData.lineItems),
        payment_method_types: paymentMethodsAllowed,
        success_url: chargeData.successUrl,
        cancel_url: chargeData.cancelUrl,
        description: chargeData.description,
        statement_descriptor: chargeData.statementDescriptor,
        send_email_receipt: Boolean(chargeData.sendEmailReceipt),
        show_description: chargeData.showDescription !== false,
        show_line_items: chargeData.showLineItems !== false,
        metadata: chargeData.metadata,
      },
    },
  };

  const response = await paymongoRequest('/checkout_sessions', {
    method: 'POST',
    body,
    idempotencyKey: options.idempotencyKey,
  });

  const session = toCheckoutSession(response, { ...chargeData, paymentMethodsAllowed });
  await persistCheckoutSession(session, chargeData, {
    paymentMethodsAllowed,
    providerMetadata: response?.data || {},
    tribeId,
  });

  return session;
}

function requirePaymentStore(feature) {
  const store = getPaymentStore();
  if (!store.enabled) {
    throw catalogDisabledError(feature);
  }

  return store;
}

function requireTribeContext(tribeId, resource) {
  if (!tribeId) {
    throw new PayMongoError(`A tribe context is required for ${resource}.`, 400);
  }
}

function generatedId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function createCustomer(payload, options = {}) {
  requireTribeContext(options.tribeId, 'payment customers');
  const store = requirePaymentStore('Payment customer catalog');
  return store.createCustomer({
    customerId: payload.customerId || generatedId('cus'),
    tribeId: options.tribeId,
    provider: 'paymongo',
    providerMode: providerMode(),
    email: payload.email,
    phone: payload.phone,
    name: payload.name,
    metadata: payload.metadata || {},
  });
}

async function getCustomer(customerId, options = {}) {
  requireTribeContext(options.tribeId, 'payment customers');
  const store = requirePaymentStore('Payment customer catalog');
  const customer = await store.getCustomer(customerId, options.tribeId);
  if (!customer) {
    throw notFoundError('Customer', customerId);
  }

  return customer;
}

async function createProduct(payload, options = {}) {
  requireTribeContext(options.tribeId, 'payment products');
  const store = requirePaymentStore('Payment product catalog');
  if (!payload.name) {
    throw new PayMongoError('Product name is required.', 400);
  }

  return store.createProduct({
    productId: payload.productId || generatedId('prod'),
    tribeId: options.tribeId,
    name: payload.name,
    description: payload.description,
    active: payload.active !== false,
    metadata: payload.metadata || {},
  });
}

async function getProduct(productId, options = {}) {
  requireTribeContext(options.tribeId, 'payment products');
  const store = requirePaymentStore('Payment product catalog');
  const product = await store.getProduct(productId, options.tribeId);
  if (!product) {
    throw notFoundError('Product', productId);
  }

  return product;
}

async function createPrice(payload, options = {}) {
  requireTribeContext(options.tribeId, 'payment prices');
  const store = requirePaymentStore('Payment price catalog');
  if (!payload.productId) {
    throw new PayMongoError('productId is required.', 400);
  }
  if (!payload.amount?.value || !payload.amount?.currency) {
    throw new PayMongoError('amount.value and amount.currency are required.', 400);
  }

  return store.createPrice({
    priceId: payload.priceId || generatedId('price'),
    tribeId: options.tribeId,
    productId: payload.productId,
    amount: payload.amount,
    recurring: payload.recurring,
    active: payload.active !== false,
    metadata: payload.metadata || {},
  });
}

async function getPrice(priceId, options = {}) {
  requireTribeContext(options.tribeId, 'payment prices');
  const store = requirePaymentStore('Payment price catalog');
  const price = await store.getPrice(priceId, options.tribeId);
  if (!price) {
    throw notFoundError('Price', priceId);
  }

  return price;
}

async function createSubscription(payload, options = {}) {
  if (!subscriptionsEnabled()) {
    throw providerDisabledError('Subscriptions');
  }

  requireTribeContext(options.tribeId, 'payment subscriptions');
  const store = requirePaymentStore('Payment subscriptions');
  if (!options.idempotencyKey) {
    throw new PayMongoError('Idempotency-Key header or idempotencyKey body field is required.', 400, {
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  }
  if (!payload.referenceId) {
    throw new PayMongoError('referenceId is required.', 400);
  }
  if (!payload.customerId) {
    throw new PayMongoError('customerId is required.', 400);
  }
  if (!payload.priceId) {
    throw new PayMongoError('priceId is required.', 400);
  }

  const customer = await store.getCustomer(payload.customerId, options.tribeId);
  if (!customer) {
    throw notFoundError('Customer', payload.customerId);
  }

  const price = await store.getPrice(payload.priceId, options.tribeId);
  if (!price) {
    throw notFoundError('Price', payload.priceId);
  }
  if (!price.recurring?.interval) {
    throw new PayMongoError('Subscriptions require a recurring price.', 400);
  }

  const idempotencyKeyHash = hashIdempotencyKey(options.idempotencyKey);
  const existing = await store.getSubscriptionByReference(payload.referenceId, options.tribeId);
  if (existing) {
    if (existing.providerMetadata?.idempotencyKeyHash === idempotencyKeyHash) {
      return existing;
    }

    throw conflictError(`Subscription reference '${payload.referenceId}' already exists for this tribe.`);
  }

  const now = Date.now();
  const trialPeriodDays = Number(payload.trialPeriodDays ?? price.recurring.trialPeriodDays ?? 0);
  const periodStart = new Date(now).toISOString();
  const periodEnd = addBillingInterval(now, price.recurring.interval, price.recurring.intervalCount || 1);
  const status = trialPeriodDays > 0 ? 'trialing' : 'active';

  return store.createSubscription({
    subscriptionId: payload.subscriptionId || generatedId('sub'),
    tribeId: options.tribeId,
    provider: 'paymongo',
    providerMode: providerMode(),
    referenceId: payload.referenceId,
    customerId: customer.customerId,
    priceId: price.priceId,
    status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    metadata: payload.metadata || {},
    providerMetadata: {
      mode: 'api-center-local',
      idempotencyKeyHash,
      paymentSubscriptionsEnabled: true,
    },
  });
}

async function getSubscription(subscriptionId, options = {}) {
  requireTribeContext(options.tribeId, 'payment subscriptions');
  const store = requirePaymentStore('Payment subscriptions');
  const subscription = await store.getSubscription(subscriptionId, options.tribeId);
  if (!subscription) {
    throw notFoundError('Subscription', subscriptionId);
  }

  return subscription;
}

async function getSubscriptionByReference(referenceId, options = {}) {
  requireTribeContext(options.tribeId, 'payment subscriptions');
  const store = requirePaymentStore('Payment subscriptions');
  const subscription = await store.getSubscriptionByReference(referenceId, options.tribeId);
  if (!subscription) {
    throw notFoundError('Subscription reference', referenceId);
  }

  return subscription;
}

async function cancelSubscription(subscriptionId, payload = {}, options = {}) {
  if (!subscriptionsEnabled()) {
    throw providerDisabledError('Subscriptions');
  }

  requireTribeContext(options.tribeId, 'payment subscriptions');
  const store = requirePaymentStore('Payment subscriptions');
  const subscription = await store.getSubscription(subscriptionId, options.tribeId);
  if (!subscription) {
    throw notFoundError('Subscription', subscriptionId);
  }

  const cancelAtPeriodEnd = payload.cancelAtPeriodEnd !== false;
  return store.updateSubscriptionStatus(subscriptionId, {
    status: cancelAtPeriodEnd ? subscription.status : 'cancelled',
    cancelAtPeriodEnd,
    metadata: {
      ...(subscription.metadata || {}),
      cancellationReason: payload.reason,
    },
  });
}

async function pauseSubscription(subscriptionId, _payload = {}, options = {}) {
  if (!subscriptionsEnabled()) {
    throw providerDisabledError('Subscriptions');
  }

  requireTribeContext(options.tribeId, 'payment subscriptions');
  const store = requirePaymentStore('Payment subscriptions');
  const subscription = await store.getSubscription(subscriptionId, options.tribeId);
  if (!subscription) {
    throw notFoundError('Subscription', subscriptionId);
  }

  return store.updateSubscriptionStatus(subscriptionId, { status: 'paused' });
}

async function resumeSubscription(subscriptionId, _payload = {}, options = {}) {
  if (!subscriptionsEnabled()) {
    throw providerDisabledError('Subscriptions');
  }

  requireTribeContext(options.tribeId, 'payment subscriptions');
  const store = requirePaymentStore('Payment subscriptions');
  const subscription = await store.getSubscription(subscriptionId, options.tribeId);
  if (!subscription) {
    throw notFoundError('Subscription', subscriptionId);
  }

  return store.updateSubscriptionStatus(subscriptionId, { status: 'active', cancelAtPeriodEnd: false });
}

async function changeSubscriptionPrice(subscriptionId, payload = {}, options = {}) {
  if (!subscriptionsEnabled()) {
    throw providerDisabledError('Subscriptions');
  }

  requireTribeContext(options.tribeId, 'payment subscriptions');
  const store = requirePaymentStore('Payment subscriptions');
  const subscription = await store.getSubscription(subscriptionId, options.tribeId);
  if (!subscription) {
    throw notFoundError('Subscription', subscriptionId);
  }
  if (!payload.priceId) {
    throw new PayMongoError('priceId is required.', 400);
  }

  const price = await store.getPrice(payload.priceId, options.tribeId);
  if (!price) {
    throw notFoundError('Price', payload.priceId);
  }
  if (!price.recurring?.interval) {
    throw new PayMongoError('Subscriptions require a recurring price.', 400);
  }

  return store.createSubscription({
    ...subscription,
    priceId: price.priceId,
    metadata: {
      ...(subscription.metadata || {}),
      ...(payload.metadata || {}),
    },
  });
}

async function listSubscriptionInvoices(subscriptionId, options = {}) {
  requireTribeContext(options.tribeId, 'payment subscription invoices');
  const store = requirePaymentStore('Subscription invoices');
  return store.listInvoicesForSubscription(subscriptionId, options.tribeId);
}

async function getInvoice(invoiceId, options = {}) {
  requireTribeContext(options.tribeId, 'payment invoices');
  const store = requirePaymentStore('Payment invoices');
  const invoice = await store.getInvoice(invoiceId, options.tribeId);
  if (!invoice) {
    throw notFoundError('Invoice', invoiceId);
  }

  return invoice;
}

function addBillingInterval(startMs, interval, intervalCount) {
  const date = new Date(startMs);
  const count = Number(intervalCount) || 1;

  if (interval === 'day') {
    date.setUTCDate(date.getUTCDate() + count);
  } else if (interval === 'week') {
    date.setUTCDate(date.getUTCDate() + count * 7);
  } else if (interval === 'year') {
    date.setUTCFullYear(date.getUTCFullYear() + count);
  } else {
    date.setUTCMonth(date.getUTCMonth() + count);
  }

  return date.toISOString();
}

async function getCheckoutSession(checkoutId) {
  if (isMockMode()) {
    return toCheckoutSession(
      {
        data: {
          id: checkoutId,
          attributes: {
            checkout_url: `https://checkout.paymongo.local/${checkoutId}`,
            status: 'pending',
          },
        },
      },
      { referenceId: checkoutId, lineItems: [] },
    );
  }

  const response = await paymongoRequest(`/checkout_sessions/${encodeURIComponent(checkoutId)}`);
  return toCheckoutSession(response, { referenceId: checkoutId, lineItems: [] });
}

async function refund(refundData, options = {}) {
  if (isMockMode()) {
    return toRefund(
      {
        data: {
          id: 'mock_refund_001',
          attributes: {
            status: 'succeeded',
          },
        },
      },
      refundData,
    );
  }

  const amount = normalizeAmount(refundData.amount);
  const response = await paymongoRequest('/refunds', {
    method: 'POST',
    idempotencyKey: options.idempotencyKey,
    body: {
      data: {
        attributes: {
          amount: amount.value,
          payment_id: refundData.payment_id,
          reason: refundData.reason || 'requested_by_customer',
          notes: refundData.notes,
          metadata: refundData.metadata,
        },
      },
    },
  });

  return toRefund(response, refundData);
}

async function webhook(webhookPayload, options = {}) {
  const rawBody = options.rawBody || JSON.stringify(webhookPayload || {});
  verifyWebhookSignature(rawBody, options.signatureHeader);

  const eventType = webhookPayload?.data?.attributes?.type || 'unknown';
  const extractedEvent = extractPayMongoEvent(webhookPayload, rawBody);
  const providerEvent = await enrichPaidCheckoutPayment(extractedEvent);
  const store = getPaymentStore();
  logWebhookExtract(providerEvent);

  const idempotency = await store.recordWebhookEvent({
    provider: providerEvent.provider,
    providerMode: providerEvent.providerMode,
    providerEventId: providerEvent.providerEventId,
    eventId: providerEvent.providerEventId,
    eventType,
    status: 'processed',
    payloadHash: providerEvent.payloadHash,
    metadata: {
      lifecycleEventType: providerEvent.eventType,
      checkoutId: providerEvent.checkoutId,
      subscriptionId: providerEvent.subscriptionId,
      invoiceId: providerEvent.invoiceId,
      paymentId: providerEvent.paymentId,
      refundId: providerEvent.refundId,
    },
  });

  if (idempotency.duplicate) {
    const updatedState = await applyWebhookState(providerEvent, store);
    logWebhookPersist(providerEvent, {
      duplicate: true,
      updatedState,
    });

    return {
      received: true,
      event: eventType,
      data: {
        eventType: providerEvent.eventType,
        status: providerEvent.status,
        checkoutId: providerEvent.checkoutId,
        subscriptionId: providerEvent.subscriptionId,
        invoiceId: providerEvent.invoiceId,
        paymentId: providerEvent.paymentId,
        refundId: providerEvent.refundId,
        updated: Boolean(updatedState.updatedCheckout || updatedState.updatedSubscription || updatedState.updatedInvoice),
        duplicate: true,
      },
    };
  }

  const updatedState = await applyWebhookState(providerEvent, store);
  logWebhookPersist(providerEvent, {
    duplicate: false,
    updatedState,
  });

  return {
    received: true,
    event: eventType,
    data: {
      eventType: providerEvent.eventType,
      status: providerEvent.status,
      checkoutId: providerEvent.checkoutId,
      subscriptionId: providerEvent.subscriptionId,
      invoiceId: providerEvent.invoiceId,
      paymentId: providerEvent.paymentId,
      refundId: providerEvent.refundId,
      updated: Boolean(updatedState.updatedCheckout || updatedState.updatedSubscription || updatedState.updatedInvoice),
      duplicate: false,
    },
  };
}

async function enrichPaidCheckoutPayment(providerEvent) {
  if (
    providerEvent.paymentId
    || providerEvent.providerEventType !== 'checkout_session.payment.paid'
    || !providerEvent.checkoutId
    || !resolveSecretKey()
    || isMockMode()
  ) {
    return providerEvent;
  }

  const checkout = await getCheckoutSession(providerEvent.checkoutId);
  const payment = extractPaymentFromCheckoutSession(checkout.providerData || checkout);
  if (!payment?.paymentId) {
    return providerEvent;
  }

  return {
    ...providerEvent,
    paymentId: payment.paymentId,
    amount: payment.amount ?? providerEvent.amount,
    currency: payment.currency || providerEvent.currency,
    paymentMethodType: payment.paymentMethodType || providerEvent.paymentMethodType,
    providerData: payment.providerData || providerEvent.providerData,
  };
}

function logWebhookExtract(providerEvent) {
  console.log(JSON.stringify({
    component: 'paymongo-webhook-extract',
    providerEventId: providerEvent.providerEventId,
    providerEventType: providerEvent.providerEventType,
    providerMode: providerEvent.providerMode,
    checkoutId: providerEvent.checkoutId,
    subscriptionId: providerEvent.subscriptionId,
    invoiceId: providerEvent.invoiceId,
    paymentIdSet: Boolean(providerEvent.paymentId),
    refundIdSet: Boolean(providerEvent.refundId),
    status: providerEvent.status,
  }));
}

function logWebhookPersist(providerEvent, { duplicate, updatedState = {} }) {
  console.log(JSON.stringify({
    component: 'paymongo-webhook-persist',
    duplicate: Boolean(duplicate),
    checkoutUpdated: Boolean(updatedState.updatedCheckout),
    subscriptionUpdated: Boolean(updatedState.updatedSubscription),
    invoiceUpdated: Boolean(updatedState.updatedInvoice),
    paymentIdSet: Boolean(providerEvent.paymentId),
    refundIdSet: Boolean(providerEvent.refundId),
  }));
}

async function getCheckoutStatus(checkoutId, options = {}) {
  const store = getPaymentStore();
  const stored = await store.getCheckoutSessionStatus(checkoutId);

  if (stored) {
    assertTribeCanRead(stored, options.tribeId);
    return stored;
  }

  if (store.enabled) {
    throw new PayMongoError(`Checkout session '${checkoutId}' was not found.`, 404);
  }

  return getCheckoutSession(checkoutId);
}

async function getCheckoutStatusByReference(referenceId, options = {}) {
  const store = getPaymentStore();

  if (!options.tribeId) {
    throw new PayMongoError('A tribe context is required to look up checkout status by reference.', 400);
  }

  const stored = await store.getCheckoutSessionByReference(referenceId, options.tribeId);
  if (stored) {
    return stored;
  }

  if (store.enabled) {
    throw new PayMongoError(`Checkout session for reference '${referenceId}' was not found.`, 404);
  }

  return null;
}

async function markCheckoutCancelled(checkoutId, options = {}) {
  const store = getPaymentStore();
  const reason = options.reason || 'user_returned_from_cancel_url';

  if (!store.enabled) {
    return {
      checkoutId,
      provider: 'paymongo',
      providerMode: providerMode(),
      status: 'cancelled',
      reason,
    };
  }

  const current = await store.getCheckoutSessionStatus(checkoutId);
  if (!current) {
    throw new PayMongoError(`Checkout session '${checkoutId}' was not found.`, 404);
  }

  assertTribeCanRead(current, options.tribeId);

  if (['paid', 'refunded', 'partially_refunded'].includes(current.status)) {
    throw new PayMongoError(`Checkout session '${checkoutId}' cannot be marked cancelled after status '${current.status}'.`, 409);
  }

  const updated = await store.updateCheckoutStatus(checkoutId, {
    status: 'cancelled',
    cancellationReason: reason,
  });

  return {
    ...updated,
    reason,
  };
}

async function persistCheckoutSession(session, request, options = {}) {
  const store = getPaymentStore();
  if (!store.enabled) {
    return null;
  }

  return store.createCheckoutSessionRecord({
    tribeId: options.tribeId,
    checkoutId: session.checkoutId,
    referenceId: session.referenceId,
    status: 'created',
    amount: session.amount,
    currency: session.amount?.currency || request.currency || 'PHP',
    provider: 'paymongo',
    providerMode: providerMode(),
    redirectUrl: session.redirectUrl,
    successUrl: request.successUrl,
    cancelUrl: request.cancelUrl,
    description: request.description,
    metadata: request.metadata || {},
    providerMetadata: options.providerMetadata || {},
    expiresAt: session.expiresAt,
  });
}

async function applyWebhookState(providerEvent, store) {
  if (!providerEvent.status || !store.enabled) {
    return {};
  }

  let updatedCheckout = null;
  let updatedSubscription = null;
  let updatedInvoice = null;
  if (providerEvent.checkoutId) {
    updatedCheckout = await store.updateCheckoutStatus(providerEvent.checkoutId, {
      status: providerEvent.status,
    });
  }

  if (providerEvent.paymentId) {
    await store.upsertPayment({
      tribeId: updatedCheckout?.tribeId || 'unknown',
      provider: 'paymongo',
      providerMode: providerEvent.providerMode,
      paymentId: providerEvent.paymentId,
      checkoutId: providerEvent.checkoutId,
      referenceId: providerEvent.referenceId || updatedCheckout?.referenceId,
      status: providerEvent.status === 'paid' ? 'paid' : providerEvent.status,
      amount: providerEvent.amount,
      currency: providerEvent.currency,
      paymentMethodType: providerEvent.paymentMethodType,
      providerMetadata: providerEvent.providerData || {},
    });
  }

  if (providerEvent.subscriptionId) {
    await store.recordSubscriptionEvent({
      provider: providerEvent.provider,
      providerMode: providerEvent.providerMode,
      providerEventId: providerEvent.providerEventId,
      subscriptionId: providerEvent.subscriptionId,
      eventType: providerEvent.eventType,
      status: providerEvent.status,
      metadata: {
        invoiceId: providerEvent.invoiceId,
        paymentId: providerEvent.paymentId,
        referenceId: providerEvent.referenceId,
      },
    });

    const currentSubscription = await store.getSubscription(providerEvent.subscriptionId);
    if (providerEvent.eventType.startsWith('payment.subscription.')) {
      updatedSubscription = await store.updateSubscriptionStatus(providerEvent.subscriptionId, {
        status: providerEvent.status,
        latestInvoiceId: providerEvent.invoiceId,
        latestPaymentId: providerEvent.paymentId,
      });
    } else if (currentSubscription) {
      updatedSubscription = await store.updateSubscriptionStatus(providerEvent.subscriptionId, {
        status: currentSubscription.status,
        latestInvoiceId: providerEvent.invoiceId,
        latestPaymentId: providerEvent.paymentId,
      });
    }
  }

  if (providerEvent.invoiceId) {
    updatedInvoice = await store.createInvoice({
      tribeId: updatedSubscription?.tribeId || updatedCheckout?.tribeId || 'unknown',
      provider: providerEvent.provider,
      providerMode: providerEvent.providerMode,
      invoiceId: providerEvent.invoiceId,
      subscriptionId: providerEvent.subscriptionId,
      customerId: providerEvent.customerId || updatedSubscription?.customerId,
      status: providerEvent.status,
      amountDue: providerEvent.status === 'paid'
        ? undefined
        : { value: Number(providerEvent.amount || 0), currency: providerEvent.currency || 'PHP' },
      amountPaid: providerEvent.status === 'paid'
        ? { value: Number(providerEvent.amount || 0), currency: providerEvent.currency || 'PHP' }
        : undefined,
      currency: providerEvent.currency || 'PHP',
      providerMetadata: providerEvent.providerData || {},
    });
  }

  if (providerEvent.refundId && providerEvent.paymentId) {
    await store.upsertRefund({
      tribeId: updatedCheckout?.tribeId || 'unknown',
      provider: 'paymongo',
      providerMode: providerEvent.providerMode,
      refundId: providerEvent.refundId,
      paymentId: providerEvent.paymentId,
      status: providerEvent.status,
      amount: providerEvent.amount || 0,
      currency: providerEvent.currency,
      providerMetadata: providerEvent.providerData || {},
    });
  }

  return {
    updatedCheckout,
    updatedSubscription,
    updatedInvoice,
  };
}

function assertTribeCanRead(session, tribeId) {
  if (tribeId && session.tribeId && tribeId !== session.tribeId) {
    throw new PayMongoError('Checkout session does not belong to the requesting tribe.', 403);
  }
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const webhookSecret = resolveWebhookSecret();

  if (
    !webhookSecret
    && process.env.NODE_ENV !== 'production'
    && (!process.env.PAYMENT_PROVIDER_MODE || process.env.PAYMENT_PROVIDER_MODE === 'mock')
  ) {
    return true;
  }

  if (!webhookSecret) {
    const mode = providerMode();
    const expectedKey = mode === 'live' ? 'PAYMONGO_LIVE_WEBHOOK_SECRET' : 'PAYMONGO_TEST_WEBHOOK_SECRET';
    throw new PayMongoError(`${expectedKey} is required for webhook verification.`, 500);
  }

  const signatureParts = parseSignatureHeader(signatureHeader);
  const timestamp = signatureParts.t;
  const expectedMode = providerMode() === 'live' ? 'li' : 'te';
  const providerSignature = signatureParts[expectedMode];

  if (!timestamp || !providerSignature) {
    throw new PayMongoError('Invalid PayMongo webhook signature header.', 401);
  }

  const computed = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(computed);
  const providerBuffer = Buffer.from(providerSignature);

  if (
    expectedBuffer.length !== providerBuffer.length
    || !crypto.timingSafeEqual(expectedBuffer, providerBuffer)
  ) {
    throw new PayMongoError('Invalid PayMongo webhook signature.', 401);
  }

  return true;
}

function resolveWebhookSecret() {
  if (providerMode() === 'live') {
    return process.env.PAYMONGO_LIVE_WEBHOOK_SECRET;
  }

  return process.env.PAYMONGO_TEST_WEBHOOK_SECRET;
}

function parseSignatureHeader(signatureHeader = '') {
  return String(signatureHeader)
    .split(',')
    .map((part) => part.trim().split('='))
    .reduce((parts, [key, value]) => {
      if (key) {
        parts[key] = value || '';
      }

      return parts;
    }, {});
}

module.exports = {
  PayMongoError,
  cancelSubscription,
  charge,
  changeSubscriptionPrice,
  createCustomer,
  createPrice,
  createProduct,
  createSubscription,
  getCustomer,
  getCheckoutSession,
  getCheckoutStatus,
  getCheckoutStatusByReference,
  getInvoice,
  getPrice,
  getProduct,
  getSubscription,
  getSubscriptionByReference,
  isPaymentStoreEnabled,
  listSubscriptionInvoices,
  markCheckoutCancelled,
  pauseSubscription,
  resolvePaymentMethods,
  refund,
  resumeSubscription,
  webhook,
  verifyWebhookSignature,
};
