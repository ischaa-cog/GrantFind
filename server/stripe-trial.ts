import crypto from "crypto";

export const LABOR_DAY_CAMPAIGN = "labor-day-bundle-2026";
export const TRIAL_DAYS = 30;
const TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const INVITE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

type TrialTokenPayload = {
  campaign: string;
  userId: number;
  expiresAt: number;
};

type InviteTokenPayload = {
  campaign: string;
  expiresAt: number;
};

export type TrialEligibilityUser = {
  subscriptionTier?: string | null;
  stripeSubscriptionId?: string | null;
  trialUsedAt?: Date | string | null;
};

export type TrialEligibilityPayment = {
  status: string;
};

function sign(encodedPayload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createLaborDayInviteToken(secret: string, now = Date.now()) {
  const payload: InviteTokenPayload = {
    campaign: LABOR_DAY_CAMPAIGN,
    expiresAt: now + INVITE_LIFETIME_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyLaborDayInviteToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
) {
  if (!token) return false;
  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) return false;

  const expectedSignature = sign(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as InviteTokenPayload;
    return payload.campaign === LABOR_DAY_CAMPAIGN && payload.expiresAt > now;
  } catch {
    return false;
  }
}

export function createTrialAccessToken(userId: number, secret: string, now = Date.now()) {
  const payload: TrialTokenPayload = {
    campaign: LABOR_DAY_CAMPAIGN,
    userId,
    expiresAt: now + TOKEN_LIFETIME_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyTrialAccessToken(
  token: string | undefined,
  expectedUserId: number,
  secret: string,
  now = Date.now(),
) {
  if (!token) return false;
  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) return false;

  const expectedSignature = sign(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as TrialTokenPayload;
    return payload.campaign === LABOR_DAY_CAMPAIGN
      && payload.userId === expectedUserId
      && payload.expiresAt > now;
  } catch {
    return false;
  }
}

export function getLocalTrialIneligibilityReason(
  user: TrialEligibilityUser,
  payments: TrialEligibilityPayment[],
) {
  if (user.trialUsedAt) return "This account has already used its GrantFind trial.";
  if (user.stripeSubscriptionId || user.subscriptionTier === "paid") {
    return "This offer is only available before your first GrantFind subscription.";
  }
  if (payments.some((payment) => payment.status === "paid")) {
    return "This offer is only available to first-time GrantFind subscribers.";
  }
  return null;
}

export function getBillingPeriodFromSubscription(
  subscription: { items?: { data?: Array<{ price?: { recurring?: { interval?: string | null } | null } | null }> } },
) {
  return subscription.items?.data?.[0]?.price?.recurring?.interval === "year" ? "annual" : "monthly";
}

export function hasPremiumAccessForStripeStatus(status: string) {
  return status === "trialing" || status === "active" || status === "past_due";
}