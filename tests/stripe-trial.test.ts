import assert from "node:assert/strict";
import test from "node:test";
import {
  createTrialAccessToken,
  createLaborDayInviteToken,
  getBillingPeriodFromSubscription,
  getLocalTrialIneligibilityReason,
  hasPremiumAccessForStripeStatus,
  verifyTrialAccessToken,
  verifyLaborDayInviteToken,
} from "../server/stripe-trial";

test("trial access tokens are user-bound and expire", () => {
  const now = Date.UTC(2026, 8, 2);
  const token = createTrialAccessToken(42, "test-secret", now);

  assert.equal(verifyTrialAccessToken(token, 42, "test-secret", now + 1), true);
  assert.equal(verifyTrialAccessToken(token, 43, "test-secret", now + 1), false);
  assert.equal(verifyTrialAccessToken(token, 42, "wrong-secret", now + 1), false);
  assert.equal(verifyTrialAccessToken(token, 42, "test-secret", now + 60 * 60 * 1000 + 1), false);
});

test("private campaign links are signed and expire", () => {
  const now = Date.UTC(2026, 8, 2);
  const token = createLaborDayInviteToken("test-secret", now);

  assert.equal(verifyLaborDayInviteToken(token, "test-secret", now + 1000), true);
  assert.equal(verifyLaborDayInviteToken(token, "wrong-secret", now + 1000), false);
  assert.equal(verifyLaborDayInviteToken(`${token}tampered`, "test-secret", now + 1000), false);
  assert.equal(
    verifyLaborDayInviteToken(token, "test-secret", now + 91 * 24 * 60 * 60 * 1000),
    false,
  );
});

test("prior trials, subscriptions, and paid payments block eligibility", () => {
  assert.match(
    getLocalTrialIneligibilityReason({ trialUsedAt: new Date() }, [] as any)!,
    /already used/i,
  );
  assert.match(
    getLocalTrialIneligibilityReason({ stripeSubscriptionId: "sub_123" }, [] as any)!,
    /before your first/i,
  );
  assert.match(
    getLocalTrialIneligibilityReason({}, [{ status: "paid" }])!,
    /first-time/i,
  );
  assert.equal(getLocalTrialIneligibilityReason({}, [{ status: "expired" }]), null);
});

test("Stripe subscription state maps to access and billing period", () => {
  assert.equal(hasPremiumAccessForStripeStatus("trialing"), true);
  assert.equal(hasPremiumAccessForStripeStatus("active"), true);
  assert.equal(hasPremiumAccessForStripeStatus("past_due"), true);
  assert.equal(hasPremiumAccessForStripeStatus("canceled"), false);

  assert.equal(getBillingPeriodFromSubscription({
    items: { data: [{ price: { recurring: { interval: "year" } } }] },
  }), "annual");
  assert.equal(getBillingPeriodFromSubscription({
    items: { data: [{ price: { recurring: { interval: "month" } } }] },
  }), "monthly");
});