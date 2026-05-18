import { JwtClaims } from './auth';

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tribeId: string;
  permissions: string[];
  scopes: string[];
}

export type ServiceTier = 'critical' | 'standard' | 'experimental';

export type ServiceLifecycleStatus = 'proposed' | 'active' | 'deprecated' | 'retired';

export type ServiceType = 'shared' | 'tribe';

export interface ServiceManifest {
  serviceId: string;
  name: string;
  baseUrl: string;
  requiredScopes: string[];
  exposes: string[];
  consumes: string[];
  serviceType?: ServiceType;
  healthCheck?: string;
  version?: string;
  description?: string;
  tags?: string[];
  ownerTeam?: string;
  contact?: string;
  serviceTier?: ServiceTier;
  costCenter?: string;
  sunsetDate?: string;
  replacementService?: string;
}

export interface ServiceRegistryEntry extends ServiceManifest {
  registeredAt: string;
  updatedAt: string;
  status: ServiceLifecycleStatus;
  previousVersion?: string;
  healthy?: boolean;
  lastHealthCheckAt?: string;
}

export interface ServiceRegistryMap {
  [serviceId: string]: ServiceRegistryEntry;
}

export interface ServiceDiscoveryEntry {
  serviceId: string;
  name: string;
  status: ServiceLifecycleStatus;
  version?: string;
  exposes: string[];
  requiredScopes: string[];
  serviceType: ServiceType;
  canAccess: boolean;
  deprecated?: boolean;
  sunsetDate?: string;
  replacementService?: string;
}

export interface ServiceScopeCatalog {
  platformScopes: string[];
  externalScopes: string[];
  dynamicServiceScopes: string[];
  allScopes: string[];
}

export interface TribeConfig {
  name: string;
  baseUrl: string;
  permissions: string[];
  exposes: string[];
  consumes: string[];
}

export interface TribeConfigMap {
  [tribeId: string]: TribeConfig;
}

export type ExternalAuthType = 'bearer' | 'api-key' | 'basic' | 'apiKey';

export interface ExternalApiConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  authType: ExternalAuthType;
  authHeader: string;
  authValue: string;
  timeout: number;
  rateLimit?: { windowMs: number; max: number };
  healthEndpoint?: string;
  description?: string;
}

export interface ExternalApiConfigMap {
  [apiName: string]: ExternalApiConfig;
}

export interface ExternalCallOptions {
  method?: string;
  path?: string;
  query?: Record<string, string>;
  body?: unknown;
  data?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  tribeId?: string;
  correlationId?: string;
}

export interface KafkaMessageMeta {
  timestamp: string;
  source: string;
  correlationId?: string;
}

export interface AuditLogEvent {
  tribeId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  correlationId?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    correlationId?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    correlationId?: string;
  };
}

export interface AuthenticatedPrincipal {
  user?: JwtClaims;
  tribeId?: string;
  correlationId?: string;
}

export type PaymentProvider = 'paymongo' | 'mock';

export type PaymentMethod =
  | 'qrph'
  | 'gcash'
  | 'grab_pay'
  | 'grabpay'
  | 'paymaya'
  | 'maya'
  | 'card'
  | 'visa'
  | 'mastercard'
  | 'dob'
  | 'brankas'
  | 'direct_online_banking'
  | 'online_banking';

export interface PaymentAmount {
  value: number;
  currency: string;
}

export interface PaymentCheckoutLineItem {
  name: string;
  quantity: number;
  amount: PaymentAmount;
}

export interface PaymentCheckoutCustomer {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface PaymentCheckoutCreateRequest {
  referenceId: string;
  /** Required by the PayMongo runtime to prevent duplicate checkout creation. */
  idempotencyKey?: string;
  mode?: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
  lineItems: PaymentCheckoutLineItem[];
  customerId?: string;
  priceId?: string;
  /**
   * Optional PayMongo checkout methods. Friendly aliases such as `maya`,
   * `grabpay`, `visa`, `mastercard`, and `direct_online_banking` are normalized
   * by the shared service and checked against platform policy.
   */
  paymentMethods?: PaymentMethod[];
  /** Backward-compatible provider-shaped field. Prefer `paymentMethods`. */
  paymentMethodTypes?: PaymentMethod[];
  customer?: PaymentCheckoutCustomer;
  metadata?: Record<string, string>;
}

export interface PaymentCheckoutSession {
  checkoutId: string;
  provider: PaymentProvider;
  status: PaymentCheckoutStatus;
  referenceId: string;
  redirectUrl: string;
  expiresAt?: string;
  amount?: PaymentAmount;
  currency?: string;
  providerMode?: 'test' | 'live';
  tribeId?: string;
  successUrl?: string;
  cancelUrl?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  paymentMethodsAllowed?: string[];
  metadata?: Record<string, string>;
}

export type PaymentCheckoutStatus =
  | 'created'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'partially_refunded';

export interface PaymentCheckoutCancellationRequest {
  reason?: 'user_returned_from_cancel_url' | 'customer_request' | 'technical_issue' | string;
}

export interface PaymentRefundCreateRequest {
  amount: PaymentAmount;
  /** Required by the PayMongo runtime to prevent duplicate refunds. */
  idempotencyKey?: string;
  reason?: string;
  referenceId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentRefund {
  refundId: string;
  paymentId: string;
  provider: PaymentProvider;
  status: 'pending' | 'succeeded' | 'failed';
  amount: PaymentAmount;
  reason?: string;
  referenceId?: string;
}

export type PaymentBillingInterval = 'day' | 'week' | 'month' | 'year';

export type PaymentSubscriptionStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled'
  | 'expired';

export interface PaymentCustomerCreateRequest {
  idempotencyKey?: string;
  customerId?: string;
  email?: string;
  phone?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface PaymentCustomer {
  customerId: string;
  provider: PaymentProvider;
  providerMode?: 'test' | 'live';
  email?: string;
  phone?: string;
  name?: string;
  metadata?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentProductCreateRequest {
  idempotencyKey?: string;
  productId?: string;
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PaymentProduct {
  productId: string;
  provider?: PaymentProvider;
  providerMode?: 'test' | 'live';
  name: string;
  description?: string;
  active: boolean;
  metadata?: Record<string, string>;
}

export interface PaymentPriceCreateRequest {
  idempotencyKey?: string;
  priceId?: string;
  productId: string;
  amount: PaymentAmount;
  recurring?: {
    interval: PaymentBillingInterval;
    intervalCount: number;
    trialPeriodDays?: number;
  };
  metadata?: Record<string, string>;
}

export interface PaymentPrice {
  priceId: string;
  provider?: PaymentProvider;
  providerMode?: 'test' | 'live';
  productId: string;
  amount: PaymentAmount;
  recurring?: {
    interval: PaymentBillingInterval;
    intervalCount: number;
    trialPeriodDays?: number;
  };
  active: boolean;
  metadata?: Record<string, string>;
}

export interface PaymentSubscriptionCreateRequest {
  subscriptionId?: string;
  referenceId: string;
  idempotencyKey?: string;
  customerId: string;
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

export interface PaymentSubscription {
  subscriptionId: string;
  provider: PaymentProvider;
  providerMode?: 'test' | 'live';
  referenceId: string;
  customerId: string;
  priceId: string;
  status: PaymentSubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  latestInvoiceId?: string;
  latestPaymentId?: string;
  metadata?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentSubscriptionCancelRequest {
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

export interface PaymentSubscriptionPauseRequest {
  reason?: string;
}

export interface PaymentSubscriptionResumeRequest {
  metadata?: Record<string, string>;
}

export interface PaymentSubscriptionChangePriceRequest {
  priceId: string;
  metadata?: Record<string, string>;
}

export interface PaymentInvoice {
  invoiceId: string;
  provider: PaymentProvider;
  providerMode?: 'test' | 'live';
  subscriptionId?: string;
  customerId?: string;
  status: 'draft' | 'open' | 'paid' | 'failed' | 'void' | 'uncollectible';
  amountDue?: PaymentAmount;
  amountPaid?: PaymentAmount;
  dueAt?: string;
  paidAt?: string;
  metadata?: Record<string, string>;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailSendRequest {
  to: EmailRecipient[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  metadata?: Record<string, string>;
}

export interface EmailSendResponse {
  messageId: string;
  provider: string;
  status: 'queued' | 'sent' | 'failed';
}

export interface SmsSendRequest {
  to: string;
  message: string;
  senderId?: string;
  metadata?: Record<string, string>;
}

export interface SmsSendResponse {
  messageId: string;
  provider: string;
  status: 'queued' | 'sent' | 'failed';
}

export interface OtpGenerateRequest {
  target: string;
  channel: 'sms' | 'email';
  length?: number;
  expiresInSeconds?: number;
}

export interface OtpGenerateResponse {
  otpId: string;
  expiresAt: string;
  channel: string;
  target: string;
  /** Only present in mock/dev mode */
  code?: string;
}

export interface OtpVerifyRequest {
  otpId: string;
  code: string;
}

export interface OtpVerifyResponse {
  valid: boolean;
  target: string;
  channel: string;
}

export interface OtpStatusResponse {
  otpId: string;
  status: 'pending' | 'used' | 'expired';
  target: string;
  channel: string;
  expiresAt: string;
}

export interface SharedMessageStatus {
  messageId: string;
  provider: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  deliveredAt?: string;
  failureReason?: string;
}

export interface GoogleAuthorizationUrlRequest {
  redirectUri: string;
  state?: string;
  scopes?: string[];
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  accessType?: 'online' | 'offline';
  prompt?: string;
  loginHint?: string;
  includeGrantedScopes?: boolean;
}

export interface GoogleAuthorizationUrlResponse {
  authorizationUrl: string;
  state?: string;
  expiresAt?: string;
}

export interface GoogleTokenExchangeRequest {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface GoogleTokenRefreshRequest {
  refreshToken: string;
}

export interface GoogleLogoutRequest {
  token?: string;
  refreshToken?: string;
  idTokenHint?: string;
}

export interface GoogleOAuthTokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
  refreshToken?: string | null;
}

export interface GoogleLogoutResponse {
  revoked: boolean;
  provider: 'google';
}

export interface GeoGeocodeAddressRequest {
  address: string;
  language?: string;
  region?: string;
}

export interface GeoReverseGeocodeRequest {
  latitude: number;
  longitude: number;
  language?: string;
  resultType?: string;
  locationType?: string;
}

export interface GeoFence {
  fenceId: string;
  name?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface GeoFenceCheckRequest {
  latitude: number;
  longitude: number;
  fenceId?: string;
  fences?: GeoFence[];
}

export interface GeoAddressResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  types?: string[];
  provider: 'google-maps' | 'mock';
  raw?: unknown;
}

export interface GeoFenceDistanceDetail {
  fenceId: string;
  name?: string;
  inside: boolean;
  distanceMeters: number;
  radiusMeters: number;
}

export interface GeoFenceCheckResponse {
  inside: boolean;
  distanceDetails: GeoFenceDistanceDetail[];
  provider: 'local';
}

export interface KafkaGovernanceCatalog {
  tenantTopicPrefix: string;
  recommendedTopics: string[];
  blockedTopicPrefixes: string[];
  requiredScopes: {
    read: string[];
    publish: string[];
  };
  schemaContract: {
    version: string;
    requiredFields: string[];
  };
}

export interface KafkaGovernedPublishRequest {
  topic: string;
  key?: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, string>;
}

export interface KafkaGovernedPublishResponse {
  topic: string;
  eventType: string;
  accepted: true;
}
