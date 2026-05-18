const CANONICAL_PAYMENT_STATUSES = [
  'created',
  'pending',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'refunded',
  'partially_refunded',
];

const CANONICAL_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired',
];

let cachedStore;
let cachedSignature;

function createPaymentStore(env = process.env) {
  const enabled = env.SHARED_SERVICES_DATABASE_ENABLED === 'true';

  if (!enabled) {
    return createDisabledPaymentStore();
  }

  if (!env.SHARED_SERVICES_DATABASE_URL) {
    throw new Error('SHARED_SERVICES_DATABASE_URL is required when SHARED_SERVICES_DATABASE_ENABLED=true.');
  }

  if (env.PAYMONGO_PAYMENT_STORE_MODE === 'memory' || env.SHARED_SERVICES_DATABASE_URL.startsWith('memory://')) {
    return createMemoryPaymentStore();
  }

  return createPostgresPaymentStore(env.SHARED_SERVICES_DATABASE_URL);
}

function getPaymentStore(env = process.env) {
  const signature = [
    env.SHARED_SERVICES_DATABASE_ENABLED,
    env.SHARED_SERVICES_DATABASE_URL,
    env.PAYMONGO_PAYMENT_STORE_MODE,
  ].join('|');

  if (!cachedStore || cachedSignature !== signature) {
    cachedStore = createPaymentStore(env);
    cachedSignature = signature;
  }

  return cachedStore;
}

function isPaymentStoreEnabled(env = process.env) {
  return env.SHARED_SERVICES_DATABASE_ENABLED === 'true';
}

function createDisabledPaymentStore() {
  return {
    enabled: false,

    async createCheckoutSessionRecord() {
      return null;
    },

    async getCheckoutSessionStatus() {
      return null;
    },

    async getCheckoutSessionByReference() {
      return null;
    },

    async updateCheckoutStatus() {
      return null;
    },

    async getPaymentByProviderId() {
      return null;
    },

    async recordWebhookEvent() {
      return { inserted: true, duplicate: false, disabled: true };
    },

    async upsertPayment() {
      return null;
    },

    async upsertRefund() {
      return null;
    },

    async createCustomer() {
      return null;
    },

    async getCustomer() {
      return null;
    },

    async createProduct() {
      return null;
    },

    async getProduct() {
      return null;
    },

    async createPrice() {
      return null;
    },

    async getPrice() {
      return null;
    },

    async createSubscription() {
      return null;
    },

    async getSubscription() {
      return null;
    },

    async getSubscriptionByReference() {
      return null;
    },

    async updateSubscriptionStatus() {
      return null;
    },

    async recordSubscriptionEvent() {
      return { inserted: true, duplicate: false, disabled: true };
    },

    async createInvoice() {
      return null;
    },

    async getInvoice() {
      return null;
    },

    async listInvoicesForSubscription() {
      return [];
    },
  };
}

function createMemoryPaymentStore() {
  const checkouts = new Map();
  const references = new Map();
  const webhookEvents = new Set();
  const payments = new Map();
  const refunds = new Map();
  const customers = new Map();
  const products = new Map();
  const prices = new Map();
  const subscriptions = new Map();
  const subscriptionReferences = new Map();
  const subscriptionEvents = new Set();
  const invoices = new Map();

  return {
    enabled: true,

    async createCheckoutSessionRecord(entry) {
      const normalized = normalizeCheckoutEntry(entry);
      checkouts.set(normalized.checkoutId, normalized);
      if (normalized.referenceId && normalized.tribeId) {
        references.set(referenceKey(normalized.referenceId, normalized.tribeId), normalized.checkoutId);
      }
      return normalized;
    },

    async getCheckoutSessionStatus(checkoutId) {
      return checkouts.get(checkoutId) || null;
    },

    async getCheckoutSessionByReference(referenceId, tribeId) {
      const checkoutId = references.get(referenceKey(referenceId, tribeId));
      return checkoutId ? checkouts.get(checkoutId) || null : null;
    },

    async updateCheckoutStatus(checkoutId, patch) {
      assertCanonicalStatus(patch.status);
      const current = checkouts.get(checkoutId);
      if (!current) {
        return null;
      }

      const updated = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      checkouts.set(checkoutId, updated);
      return updated;
    },

    async recordWebhookEvent(event) {
      const key = webhookEventKey(event);
      if (webhookEvents.has(key)) {
        return { inserted: false, duplicate: true };
      }

      webhookEvents.add(key);
      return { inserted: true, duplicate: false };
    },

    async upsertPayment(entry) {
      payments.set(entry.paymentId, entry);
      return entry;
    },

    async getPaymentByProviderId(paymentId) {
      return payments.get(paymentId) || null;
    },

    async upsertRefund(entry) {
      refunds.set(entry.refundId, entry);
      return entry;
    },

    async createCustomer(entry) {
      const normalized = normalizeCustomerEntry(entry);
      customers.set(normalized.customerId, normalized);
      return normalized;
    },

    async getCustomer(customerId, tribeId) {
      return tenantScoped(customers.get(customerId), tribeId);
    },

    async createProduct(entry) {
      const normalized = normalizeProductEntry(entry);
      products.set(normalized.productId, normalized);
      return normalized;
    },

    async getProduct(productId, tribeId) {
      return tenantScoped(products.get(productId), tribeId);
    },

    async createPrice(entry) {
      const normalized = normalizePriceEntry(entry);
      prices.set(normalized.priceId, normalized);
      return normalized;
    },

    async getPrice(priceId, tribeId) {
      return tenantScoped(prices.get(priceId), tribeId);
    },

    async createSubscription(entry) {
      const normalized = normalizeSubscriptionEntry(entry);
      subscriptions.set(normalized.subscriptionId, normalized);
      if (normalized.referenceId && normalized.tribeId) {
        subscriptionReferences.set(referenceKey(normalized.referenceId, normalized.tribeId), normalized.subscriptionId);
      }
      return normalized;
    },

    async getSubscription(subscriptionId, tribeId) {
      return tenantScoped(subscriptions.get(subscriptionId), tribeId);
    },

    async getSubscriptionByReference(referenceId, tribeId) {
      const subscriptionId = subscriptionReferences.get(referenceKey(referenceId, tribeId));
      return subscriptionId ? tenantScoped(subscriptions.get(subscriptionId), tribeId) : null;
    },

    async updateSubscriptionStatus(subscriptionId, patch) {
      assertCanonicalSubscriptionStatus(patch.status);
      const current = subscriptions.get(subscriptionId);
      if (!current) {
        return null;
      }

      const updated = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      subscriptions.set(subscriptionId, updated);
      return updated;
    },

    async recordSubscriptionEvent(event) {
      const key = webhookEventKey(event);
      if (subscriptionEvents.has(key)) {
        return { inserted: false, duplicate: true };
      }

      subscriptionEvents.add(key);
      return { inserted: true, duplicate: false };
    },

    async createInvoice(entry) {
      const normalized = normalizeInvoiceEntry(entry);
      invoices.set(normalized.invoiceId, normalized);
      return normalized;
    },

    async getInvoice(invoiceId, tribeId) {
      return tenantScoped(invoices.get(invoiceId), tribeId);
    },

    async listInvoicesForSubscription(subscriptionId, tribeId) {
      return Array.from(invoices.values()).filter(
        (invoice) => invoice.subscriptionId === subscriptionId && invoice.tribeId === tribeId,
      );
    },
  };
}

function createPostgresPaymentStore(databaseUrl) {
  let sqlPromise;

  async function getSql() {
    if (!sqlPromise) {
      sqlPromise = Promise.resolve()
        .then(() => require('postgres'))
        .then((postgres) => postgres(databaseUrl, { max: 3 }));
    }

    return sqlPromise;
  }

  return {
    enabled: true,

    async createCheckoutSessionRecord(entry) {
      const sql = await getSql();
      const normalized = normalizeCheckoutEntry(entry);
      const rows = await sql`
        insert into shared_payment.checkout_sessions (
          tribe_id,
          provider,
          provider_mode,
          checkout_id,
          reference_id,
          status,
          amount,
          currency,
          redirect_url,
          success_url,
          cancel_url,
          description,
          metadata,
          provider_metadata,
          expires_at
        )
        values (
          ${normalized.tribeId},
          ${normalized.provider},
          ${normalized.providerMode},
          ${normalized.checkoutId},
          ${normalized.referenceId || null},
          ${normalized.status},
          ${normalized.amount?.value ?? null},
          ${normalized.amount?.currency || normalized.currency || 'PHP'},
          ${normalized.redirectUrl || null},
          ${normalized.successUrl || null},
          ${normalized.cancelUrl || null},
          ${normalized.description || null},
          ${sql.json(normalized.metadata || {})},
          ${sql.json(normalized.providerMetadata || {})},
          ${normalized.expiresAt || null}
        )
        on conflict (checkout_id) do update set
          reference_id = excluded.reference_id,
          status = excluded.status,
          amount = excluded.amount,
          currency = excluded.currency,
          redirect_url = excluded.redirect_url,
          success_url = excluded.success_url,
          cancel_url = excluded.cancel_url,
          description = excluded.description,
          metadata = excluded.metadata,
          provider_metadata = excluded.provider_metadata,
          expires_at = excluded.expires_at,
          updated_at = now()
        returning *
      `;

      return rowToCheckout(rows[0]);
    },

    async getCheckoutSessionStatus(checkoutId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.checkout_sessions
        where checkout_id = ${checkoutId}
        limit 1
      `;

      return rows[0] ? rowToCheckout(rows[0]) : null;
    },

    async getCheckoutSessionByReference(referenceId, tribeId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.checkout_sessions
        where reference_id = ${referenceId}
          and tribe_id = ${tribeId}
        order by created_at desc
        limit 1
      `;

      return rows[0] ? rowToCheckout(rows[0]) : null;
    },

    async updateCheckoutStatus(checkoutId, patch) {
      assertCanonicalStatus(patch.status);
      const sql = await getSql();
      const metadata = patch.cancellationReason
        ? { cancellationReason: patch.cancellationReason }
        : {};
      const rows = await sql`
        update shared_payment.checkout_sessions
        set
          status = ${patch.status},
          metadata = metadata || ${sql.json(metadata)},
          updated_at = now()
        where checkout_id = ${checkoutId}
        returning *
      `;

      return rows[0] ? rowToCheckout(rows[0]) : null;
    },

    async recordWebhookEvent(event) {
      const sql = await getSql();
      const rows = await sql`
        insert into shared_payment.payment_webhook_events (
          provider,
          provider_mode,
          provider_event_id,
          event_type,
          status,
          payload_hash,
          metadata,
          processed_at
        )
        values (
          ${event.provider || 'paymongo'},
          ${event.providerMode || 'test'},
          ${event.eventId || event.providerEventId},
          ${event.eventType || 'unknown'},
          ${event.status || 'received'},
          ${event.payloadHash || null},
          ${sql.json(event.metadata || {})},
          now()
        )
        on conflict (provider, provider_mode, provider_event_id) do nothing
        returning id
      `;

      return rows.length > 0
        ? { inserted: true, duplicate: false }
        : { inserted: false, duplicate: true };
    },

    async upsertPayment(entry) {
      const sql = await getSql();
      const rows = await sql`
        insert into shared_payment.payments (
          tribe_id,
          provider,
          provider_mode,
          payment_id,
          checkout_id,
          reference_id,
          status,
          amount,
          currency,
          payment_method_type,
          provider_metadata
        )
        values (
          ${entry.tribeId},
          ${entry.provider || 'paymongo'},
          ${entry.providerMode || 'test'},
          ${entry.paymentId},
          ${entry.checkoutId || null},
          ${entry.referenceId || null},
          ${entry.status || 'paid'},
          ${entry.amount?.value ?? entry.amount ?? null},
          ${entry.amount?.currency || entry.currency || 'PHP'},
          ${entry.paymentMethodType || null},
          ${sql.json(entry.providerMetadata || {})}
        )
        on conflict (payment_id) do update set
          tribe_id = case
            when excluded.tribe_id <> 'unknown' then excluded.tribe_id
            else shared_payment.payments.tribe_id
          end,
          checkout_id = coalesce(excluded.checkout_id, shared_payment.payments.checkout_id),
          reference_id = coalesce(excluded.reference_id, shared_payment.payments.reference_id),
          status = excluded.status,
          amount = excluded.amount,
          currency = excluded.currency,
          payment_method_type = excluded.payment_method_type,
          provider_metadata = excluded.provider_metadata,
          updated_at = now()
        returning *
      `;

      return rows[0] || null;
    },

    async getPaymentByProviderId(paymentId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.payments
        where payment_id = ${paymentId}
        limit 1
      `;

      return rows[0] ? rowToPayment(rows[0]) : null;
    },

    async upsertRefund(entry) {
      const sql = await getSql();
      const rows = await sql`
        insert into shared_payment.refunds (
          tribe_id,
          provider,
          provider_mode,
          refund_id,
          payment_id,
          status,
          amount,
          currency,
          reason,
          provider_metadata
        )
        values (
          ${entry.tribeId},
          ${entry.provider || 'paymongo'},
          ${entry.providerMode || 'test'},
          ${entry.refundId},
          ${entry.paymentId},
          ${entry.status || 'succeeded'},
          ${entry.amount?.value ?? entry.amount},
          ${entry.amount?.currency || entry.currency || 'PHP'},
          ${entry.reason || null},
          ${sql.json(entry.providerMetadata || {})}
        )
        on conflict (refund_id) do update set
          status = excluded.status,
          amount = excluded.amount,
          currency = excluded.currency,
          reason = excluded.reason,
          provider_metadata = excluded.provider_metadata,
          updated_at = now()
        returning *
      `;

      return rows[0] || null;
    },

    async createCustomer(entry) {
      const sql = await getSql();
      const normalized = normalizeCustomerEntry(entry);
      const rows = await sql`
        insert into shared_payment.customers (
          tribe_id,
          provider,
          provider_mode,
          customer_id,
          email,
          phone,
          name,
          metadata,
          provider_metadata
        )
        values (
          ${normalized.tribeId},
          ${normalized.provider},
          ${normalized.providerMode},
          ${normalized.customerId},
          ${normalized.email || null},
          ${normalized.phone || null},
          ${normalized.name || null},
          ${sql.json(normalized.metadata || {})},
          ${sql.json(normalized.providerMetadata || {})}
        )
        on conflict (customer_id) do update set
          email = excluded.email,
          phone = excluded.phone,
          name = excluded.name,
          metadata = excluded.metadata,
          provider_metadata = excluded.provider_metadata,
          updated_at = now()
        returning *
      `;

      return rowToCustomer(rows[0]);
    },

    async getCustomer(customerId, tribeId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.customers
        where customer_id = ${customerId}
          and tribe_id = ${tribeId}
        limit 1
      `;

      return rows[0] ? rowToCustomer(rows[0]) : null;
    },

    async createProduct(entry) {
      const sql = await getSql();
      const normalized = normalizeProductEntry(entry);
      const rows = await sql`
        insert into shared_payment.products (
          tribe_id,
          product_id,
          name,
          description,
          active,
          metadata,
          provider_metadata
        )
        values (
          ${normalized.tribeId},
          ${normalized.productId},
          ${normalized.name},
          ${normalized.description || null},
          ${normalized.active},
          ${sql.json(normalized.metadata || {})},
          ${sql.json(normalized.providerMetadata || {})}
        )
        on conflict (product_id) do update set
          name = excluded.name,
          description = excluded.description,
          active = excluded.active,
          metadata = excluded.metadata,
          provider_metadata = excluded.provider_metadata,
          updated_at = now()
        returning *
      `;

      return rowToProduct(rows[0]);
    },

    async getProduct(productId, tribeId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.products
        where product_id = ${productId}
          and tribe_id = ${tribeId}
        limit 1
      `;

      return rows[0] ? rowToProduct(rows[0]) : null;
    },

    async createPrice(entry) {
      const sql = await getSql();
      const normalized = normalizePriceEntry(entry);
      const rows = await sql`
        insert into shared_payment.prices (
          tribe_id,
          price_id,
          product_id,
          amount,
          currency,
          recurring_interval,
          recurring_interval_count,
          trial_period_days,
          active,
          metadata,
          provider_metadata
        )
        values (
          ${normalized.tribeId},
          ${normalized.priceId},
          ${normalized.productId},
          ${normalized.amount?.value ?? null},
          ${normalized.amount?.currency || normalized.currency || 'PHP'},
          ${normalized.recurring?.interval || null},
          ${normalized.recurring?.intervalCount || null},
          ${normalized.recurring?.trialPeriodDays || null},
          ${normalized.active},
          ${sql.json(normalized.metadata || {})},
          ${sql.json(normalized.providerMetadata || {})}
        )
        on conflict (price_id) do update set
          product_id = excluded.product_id,
          amount = excluded.amount,
          currency = excluded.currency,
          recurring_interval = excluded.recurring_interval,
          recurring_interval_count = excluded.recurring_interval_count,
          trial_period_days = excluded.trial_period_days,
          active = excluded.active,
          metadata = excluded.metadata,
          provider_metadata = excluded.provider_metadata,
          updated_at = now()
        returning *
      `;

      return rowToPrice(rows[0]);
    },

    async getPrice(priceId, tribeId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.prices
        where price_id = ${priceId}
          and tribe_id = ${tribeId}
        limit 1
      `;

      return rows[0] ? rowToPrice(rows[0]) : null;
    },

    async createSubscription(entry) {
      const sql = await getSql();
      const normalized = normalizeSubscriptionEntry(entry);
      const rows = await sql`
        insert into shared_payment.subscriptions (
          tribe_id,
          provider,
          provider_mode,
          subscription_id,
          reference_id,
          customer_id,
          price_id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          latest_invoice_id,
          latest_payment_id,
          metadata,
          provider_metadata
        )
        values (
          ${normalized.tribeId},
          ${normalized.provider},
          ${normalized.providerMode},
          ${normalized.subscriptionId},
          ${normalized.referenceId || null},
          ${normalized.customerId},
          ${normalized.priceId},
          ${normalized.status},
          ${normalized.currentPeriodStart || null},
          ${normalized.currentPeriodEnd || null},
          ${Boolean(normalized.cancelAtPeriodEnd)},
          ${normalized.latestInvoiceId || null},
          ${normalized.latestPaymentId || null},
          ${sql.json(normalized.metadata || {})},
          ${sql.json(normalized.providerMetadata || {})}
        )
        on conflict (subscription_id) do update set
          reference_id = excluded.reference_id,
          customer_id = excluded.customer_id,
          price_id = excluded.price_id,
          status = excluded.status,
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = excluded.cancel_at_period_end,
          latest_invoice_id = excluded.latest_invoice_id,
          latest_payment_id = excluded.latest_payment_id,
          metadata = excluded.metadata,
          provider_metadata = excluded.provider_metadata,
          updated_at = now()
        returning *
      `;

      return rowToSubscription(rows[0]);
    },

    async getSubscription(subscriptionId, tribeId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.subscriptions
        where subscription_id = ${subscriptionId}
          and tribe_id = ${tribeId}
        limit 1
      `;

      return rows[0] ? rowToSubscription(rows[0]) : null;
    },

    async getSubscriptionByReference(referenceId, tribeId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.subscriptions
        where reference_id = ${referenceId}
          and tribe_id = ${tribeId}
        order by created_at desc
        limit 1
      `;

      return rows[0] ? rowToSubscription(rows[0]) : null;
    },

    async updateSubscriptionStatus(subscriptionId, patch) {
      assertCanonicalSubscriptionStatus(patch.status);
      const sql = await getSql();
      const rows = await sql`
        update shared_payment.subscriptions
        set
          status = ${patch.status},
          current_period_start = coalesce(${patch.currentPeriodStart || null}, current_period_start),
          current_period_end = coalesce(${patch.currentPeriodEnd || null}, current_period_end),
          cancel_at_period_end = coalesce(${patch.cancelAtPeriodEnd ?? null}, cancel_at_period_end),
          latest_invoice_id = coalesce(${patch.latestInvoiceId || null}, latest_invoice_id),
          latest_payment_id = coalesce(${patch.latestPaymentId || null}, latest_payment_id),
          updated_at = now()
        where subscription_id = ${subscriptionId}
        returning *
      `;

      return rows[0] ? rowToSubscription(rows[0]) : null;
    },

    async recordSubscriptionEvent(event) {
      const sql = await getSql();
      const rows = await sql`
        insert into shared_payment.subscription_events (
          provider,
          provider_mode,
          provider_event_id,
          subscription_id,
          event_type,
          status,
          metadata,
          processed_at
        )
        values (
          ${event.provider || 'paymongo'},
          ${event.providerMode || 'test'},
          ${event.providerEventId || event.eventId},
          ${event.subscriptionId || null},
          ${event.eventType || 'unknown'},
          ${event.status || 'received'},
          ${sql.json(event.metadata || {})},
          now()
        )
        on conflict (provider, provider_mode, provider_event_id) do nothing
        returning id
      `;

      return rows.length > 0
        ? { inserted: true, duplicate: false }
        : { inserted: false, duplicate: true };
    },

    async createInvoice(entry) {
      const sql = await getSql();
      const normalized = normalizeInvoiceEntry(entry);
      const rows = await sql`
        insert into shared_payment.invoices (
          tribe_id,
          provider,
          provider_mode,
          invoice_id,
          subscription_id,
          customer_id,
          status,
          amount_due,
          amount_paid,
          currency,
          due_at,
          paid_at,
          metadata,
          provider_metadata
        )
        values (
          ${normalized.tribeId},
          ${normalized.provider},
          ${normalized.providerMode},
          ${normalized.invoiceId},
          ${normalized.subscriptionId || null},
          ${normalized.customerId || null},
          ${normalized.status},
          ${normalized.amountDue?.value ?? null},
          ${normalized.amountPaid?.value ?? null},
          ${normalized.amountDue?.currency || normalized.amountPaid?.currency || normalized.currency || 'PHP'},
          ${normalized.dueAt || null},
          ${normalized.paidAt || null},
          ${sql.json(normalized.metadata || {})},
          ${sql.json(normalized.providerMetadata || {})}
        )
        on conflict (invoice_id) do update set
          subscription_id = excluded.subscription_id,
          customer_id = excluded.customer_id,
          status = excluded.status,
          amount_due = excluded.amount_due,
          amount_paid = excluded.amount_paid,
          currency = excluded.currency,
          due_at = excluded.due_at,
          paid_at = excluded.paid_at,
          metadata = excluded.metadata,
          provider_metadata = excluded.provider_metadata,
          updated_at = now()
        returning *
      `;

      return rowToInvoice(rows[0]);
    },

    async getInvoice(invoiceId, tribeId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.invoices
        where invoice_id = ${invoiceId}
          and tribe_id = ${tribeId}
        limit 1
      `;

      return rows[0] ? rowToInvoice(rows[0]) : null;
    },

    async listInvoicesForSubscription(subscriptionId, tribeId) {
      const sql = await getSql();
      const rows = await sql`
        select *
        from shared_payment.invoices
        where subscription_id = ${subscriptionId}
          and tribe_id = ${tribeId}
        order by created_at desc
      `;

      return rows.map(rowToInvoice);
    },
  };
}

function rowToPayment(row) {
  return {
    id: row.id,
    tribeId: row.tribe_id,
    provider: row.provider,
    providerMode: row.provider_mode,
    paymentId: row.payment_id,
    checkoutId: row.checkout_id,
    referenceId: row.reference_id,
    status: row.status,
    amount: row.amount === null || row.amount === undefined
      ? undefined
      : { value: Number(row.amount), currency: row.currency || 'PHP' },
    currency: row.currency,
    paymentMethodType: row.payment_method_type,
    providerMetadata: row.provider_metadata || {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function normalizeCheckoutEntry(entry) {
  assertCanonicalStatus(entry.status);
  const now = new Date().toISOString();

  return {
    provider: 'paymongo',
    providerMode: 'test',
    metadata: {},
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
    ...entry,
  };
}

function normalizeCustomerEntry(entry) {
  const now = new Date().toISOString();
  return {
    provider: 'paymongo',
    providerMode: 'test',
    metadata: {},
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
    ...entry,
  };
}

function normalizeProductEntry(entry) {
  const now = new Date().toISOString();
  return {
    active: true,
    metadata: {},
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
    ...entry,
  };
}

function normalizePriceEntry(entry) {
  const now = new Date().toISOString();
  return {
    active: true,
    metadata: {},
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
    ...entry,
  };
}

function normalizeSubscriptionEntry(entry) {
  assertCanonicalSubscriptionStatus(entry.status);
  const now = new Date().toISOString();
  return {
    provider: 'paymongo',
    providerMode: 'test',
    cancelAtPeriodEnd: false,
    metadata: {},
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
    ...entry,
  };
}

function normalizeInvoiceEntry(entry) {
  const now = new Date().toISOString();
  return {
    provider: 'paymongo',
    providerMode: 'test',
    metadata: {},
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
    ...entry,
  };
}

function assertCanonicalStatus(status) {
  if (!CANONICAL_PAYMENT_STATUSES.includes(status)) {
    throw new Error(`Unsupported payment status: ${status}.`);
  }
}

function assertCanonicalSubscriptionStatus(status) {
  if (!CANONICAL_SUBSCRIPTION_STATUSES.includes(status)) {
    throw new Error(`Unsupported subscription status: ${status}.`);
  }
}

function tenantScoped(entry, tribeId) {
  if (!entry || (tribeId && entry.tribeId !== tribeId)) {
    return null;
  }

  return entry;
}

function rowToCheckout(row) {
  return {
    checkoutId: row.checkout_id,
    tribeId: row.tribe_id,
    referenceId: row.reference_id,
    status: row.status,
    amount: row.amount === null || row.amount === undefined
      ? undefined
      : { value: Number(row.amount), currency: row.currency || 'PHP' },
    currency: row.currency,
    provider: row.provider,
    providerMode: row.provider_mode,
    redirectUrl: row.redirect_url,
    successUrl: row.success_url,
    cancelUrl: row.cancel_url,
    description: row.description,
    metadata: row.metadata || {},
    providerMetadata: row.provider_metadata || {},
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function rowToCustomer(row) {
  return {
    customerId: row.customer_id,
    tribeId: row.tribe_id,
    provider: row.provider,
    providerMode: row.provider_mode,
    email: row.email,
    phone: row.phone,
    name: row.name,
    metadata: row.metadata || {},
    providerMetadata: row.provider_metadata || {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function rowToProduct(row) {
  return {
    productId: row.product_id,
    tribeId: row.tribe_id,
    name: row.name,
    description: row.description,
    active: row.active,
    metadata: row.metadata || {},
    providerMetadata: row.provider_metadata || {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function rowToPrice(row) {
  return {
    priceId: row.price_id,
    tribeId: row.tribe_id,
    productId: row.product_id,
    amount: row.amount === null || row.amount === undefined
      ? undefined
      : { value: Number(row.amount), currency: row.currency || 'PHP' },
    currency: row.currency,
    recurring: row.recurring_interval
      ? {
        interval: row.recurring_interval,
        intervalCount: Number(row.recurring_interval_count || 1),
        trialPeriodDays: row.trial_period_days === null || row.trial_period_days === undefined
          ? undefined
          : Number(row.trial_period_days),
      }
      : undefined,
    active: row.active,
    metadata: row.metadata || {},
    providerMetadata: row.provider_metadata || {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function rowToSubscription(row) {
  return {
    subscriptionId: row.subscription_id,
    tribeId: row.tribe_id,
    provider: row.provider,
    providerMode: row.provider_mode,
    referenceId: row.reference_id,
    customerId: row.customer_id,
    priceId: row.price_id,
    status: row.status,
    currentPeriodStart: row.current_period_start ? new Date(row.current_period_start).toISOString() : undefined,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end).toISOString() : undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    latestInvoiceId: row.latest_invoice_id,
    latestPaymentId: row.latest_payment_id,
    metadata: row.metadata || {},
    providerMetadata: row.provider_metadata || {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function rowToInvoice(row) {
  return {
    invoiceId: row.invoice_id,
    tribeId: row.tribe_id,
    provider: row.provider,
    providerMode: row.provider_mode,
    subscriptionId: row.subscription_id,
    customerId: row.customer_id,
    status: row.status,
    amountDue: row.amount_due === null || row.amount_due === undefined
      ? undefined
      : { value: Number(row.amount_due), currency: row.currency || 'PHP' },
    amountPaid: row.amount_paid === null || row.amount_paid === undefined
      ? undefined
      : { value: Number(row.amount_paid), currency: row.currency || 'PHP' },
    currency: row.currency,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : undefined,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : undefined,
    metadata: row.metadata || {},
    providerMetadata: row.provider_metadata || {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function webhookEventKey(event) {
  return [
    event.provider || 'paymongo',
    event.providerMode || 'test',
    event.eventId || event.providerEventId,
  ].join(':');
}

function referenceKey(referenceId, tribeId) {
  return `${tribeId}:${referenceId}`;
}

module.exports = {
  CANONICAL_PAYMENT_STATUSES,
  CANONICAL_SUBSCRIPTION_STATUSES,
  createDisabledPaymentStore,
  createMemoryPaymentStore,
  createPaymentStore,
  createPostgresPaymentStore,
  getPaymentStore,
  isPaymentStoreEnabled,
};
