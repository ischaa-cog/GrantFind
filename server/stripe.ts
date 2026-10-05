import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import { authenticateToken, type AuthenticatedRequest } from "./auth";
import { authenticateAdmin, type AuthenticatedAdminRequest } from "./admin-auth";
import { storagePromise } from "./storage";
import { Resend } from "resend";
import { sendTrialEndingSoonEmail, sendTrialStartedEmail } from "./email";
import {
  LABOR_DAY_CAMPAIGN,
  TRIAL_DAYS,
  createLaborDayInviteToken,
  createTrialAccessToken,
  getBillingPeriodFromSubscription,
  getLocalTrialIneligibilityReason,
  hasPremiumAccessForStripeStatus,
  verifyLaborDayInviteToken,
  verifyTrialAccessToken,
} from "./stripe-trial";

function getStripe(): Stripe | null {
  // Live key takes priority when both are set — test key only used if live key is absent
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_TEST;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-04-30.basil" as any });
}

export async function reconcilePendingCheckoutPayments(from?: Date, to?: Date) {
  const stripe = getStripe();
  if (!stripe) return { checked: 0, markedPaid: 0, markedExpired: 0 };

  const storage = await storagePromise;
  const pendingPayments = await storage.getPaymentsByStatus("pending", from, to);
  let markedPaid = 0;
  let markedExpired = 0;

  for (const payment of pendingPayments) {
    try {
      const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
      if (session.payment_status === "paid") {
        await storage.updatePaymentStatus(
          payment.stripeSessionId,
          "paid",
          (session.payment_intent as string) || undefined,
        );
        markedPaid += 1;
      } else if (session.status === "expired") {
        await storage.updatePaymentStatus(payment.stripeSessionId, "expired");
        markedExpired += 1;
      }
    } catch (error) {
      console.warn(`Unable to reconcile Stripe checkout session ${payment.id}; leaving it pending.`, error);
    }
  }

  return { checked: pendingPayments.length, markedPaid, markedExpired };
}

export async function getStripePaymentMetrics(from: Date, to: Date) {
  const invoices = await listPaidStripeInvoices(from, to);
  const unsupportedCurrency = invoices.find((invoice) => invoice.currency !== "usd");
  if (unsupportedCurrency) {
    throw new Error("Stripe report contains a non-USD paid invoice; refusing to combine currencies.");
  }

  const billableInvoices = invoices.filter((invoice) => invoice.amount_paid > 0);

  return {
    amountCents: billableInvoices.reduce((total, invoice) => total + invoice.amount_paid, 0),
    count: billableInvoices.length,
  };
}

async function listPaidStripeInvoices(from: Date, to: Date) {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured; payment reporting is unavailable.");
  }

  const invoices: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;

  do {
    const page = await stripe.invoices.list({
      status: "paid",
      created: {
        gte: Math.floor(from.getTime() / 1000),
        lte: Math.floor(to.getTime() / 1000),
      },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    invoices.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);

  return invoices;
}

async function recordPaidInvoice(invoice: Stripe.Invoice, includeSubscriptionCreations = false) {
  const isRenewal = invoice.billing_reason === "subscription_cycle";
  const isSubscriptionCreation = invoice.billing_reason === "subscription_create";
  if ((!isRenewal && (!includeSubscriptionCreations || !isSubscriptionCreation)) || !invoice.id || invoice.amount_paid <= 0) {
    return false;
  }

  const storage = await storagePromise;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  let user = customerId ? await storage.getUserByStripeCustomerId(customerId) : undefined;
  if (!user && invoice.customer_email) {
    user = await storage.getUserByEmail(invoice.customer_email);
  }
  if (!user) return false;

  if (customerId && !user.stripeCustomerId) {
    await storage.updateUser(user.id, { stripeCustomerId: customerId } as any);
  }

  // Checkout sessions are recorded when the user starts checkout, so a paid
  // subscription-creation invoice may already be represented by a nearby
  // checkout payment. Renewals do not have that local checkout record.
  if (isSubscriptionCreation) {
    const invoiceTimestamp = invoice.created * 1000;
    const matchingCheckoutPayment = (await storage.getUserPayments(user.id)).some((payment) => {
      const paymentTimestamp = payment.createdAt?.getTime();
      return payment.status === "paid"
        && payment.amount === invoice.amount_paid
        && paymentTimestamp !== undefined
        && Math.abs(paymentTimestamp - invoiceTimestamp) <= 15 * 60 * 1000;
    });
    if (matchingCheckoutPayment) return false;
  }

  const invoicePaymentIntent = (invoice as any).payment_intent;
  const paymentIntentId = typeof invoicePaymentIntent === "string"
    ? invoicePaymentIntent
    : invoicePaymentIntent?.id;
  const existingPayment = await storage.getPaymentBySessionId(invoice.id);

  if (existingPayment) {
    await storage.updatePaymentStatus(invoice.id, "paid", paymentIntentId);
    return false;
  }

  await storage.createPayment({
    userId: user.id,
    // Invoice IDs are stable and distinct from Checkout Session IDs.
    // The existing column is the ledger's external-payment identifier.
    stripeSessionId: invoice.id,
    stripePaymentIntentId: paymentIntentId,
    amount: invoice.amount_paid,
    currency: invoice.currency || "usd",
    status: "paid",
  });
  return true;
}

export async function reconcilePaidRenewalInvoices(from: Date, to: Date) {
  const invoices = await listPaidStripeInvoices(from, to);

  let recorded = 0;
  for (const invoice of invoices) {
    if (await recordPaidInvoice(invoice, true)) recorded += 1;
  }

  return { checked: invoices.length, recorded };
}

function getBaseUrl(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}`;
}

async function getTrialIneligibilityReason(stripe: Stripe, userId: number) {
  const storage = await storagePromise;
  const user = await storage.getUser(userId);
  if (!user) return "User not found.";

  const localReason = getLocalTrialIneligibilityReason(
    user,
    await storage.getUserPayments(userId),
  );
  if (localReason) return localReason;

  if (user.stripeCustomerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "all",
      limit: 1,
    });
    if (subscriptions.data.length > 0) {
      return "This offer is only available to first-time GrantFind subscribers.";
    }
  }

  return null;
}

async function syncSubscriptionToUser(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  userId?: number,
  options: { retryOnEmailFailure?: boolean } = {},
) {
  const storage = await storagePromise;
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const user = userId
    ? await storage.getUser(userId)
    : await storage.getUserByStripeCustomerId(customerId);
  if (!user) return;

  const trialStartedAt = subscription.trial_start
    ? new Date(subscription.trial_start * 1000)
    : null;
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;
  const billingPeriod = getBillingPeriodFromSubscription(subscription);
  const hasPremiumAccess = hasPremiumAccessForStripeStatus(subscription.status);
  const subscriptionItem = subscription.items.data[0];
  const periodStart = subscriptionItem?.current_period_start || subscription.created;
  const periodEnd = subscriptionItem?.current_period_end
    || subscription.trial_end
    || subscription.cancel_at
    || subscription.created;

  await storage.updateUser(user.id, {
    subscriptionTier: hasPremiumAccess ? "paid" : "free",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionBillingPeriod: billingPeriod,
    subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscriptionStartDate: new Date(periodStart * 1000),
    subscriptionEndDate: new Date(periodEnd * 1000),
    ...(trialStartedAt ? { trialStartedAt } : {}),
    ...(trialEndsAt ? { trialEndsAt } : {}),
    ...(subscription.status === "trialing" && !user.trialUsedAt
      ? { trialUsedAt: new Date() }
      : {}),
  } as any);

  if (
    subscription.status === "trialing"
    && trialEndsAt
    && !user.trialStartEmailSentAt
    && await storage.claimTrialStartEmail(user.id)
  ) {
    const sent = await sendTrialStartedEmail(
      user.email,
      user.firstName,
      trialEndsAt,
      billingPeriod,
    );
    if (!sent) {
      await storage.updateUser(user.id, { trialStartEmailSentAt: null } as any);
      if (options.retryOnEmailFailure) {
        throw new Error("Trial-start email delivery failed.");
      }
    }
  }
}

export function registerStripeRoutes(app: Express) {
  app.get(
    "/api/admin/stripe/labor-day-trial-link",
    authenticateAdmin,
    async (req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const secret = process.env.SESSION_SECRET;
        if (!secret) {
          return res.status(503).json({ message: "The private trial link is not configured." });
        }
        return res.json({
          url: `${getBaseUrl(req)}/labor-day-bundle?invite=${createLaborDayInviteToken(secret)}`,
          expiresInDays: 90,
        });
      } catch (error: any) {
        console.error("Private trial link error:", error);
        return res.status(500).json({ message: "Could not create the private trial link." });
      }
    },
  );

  app.post("/api/stripe/labor-day-trial/invite", (req: Request, res: Response) => {
    const secret = process.env.SESSION_SECRET;
    const { inviteToken } = req.body as { inviteToken?: string };
    if (!secret || !verifyLaborDayInviteToken(inviteToken, secret)) {
      return res.status(403).json({ valid: false });
    }
    return res.json({ valid: true });
  });

  app.post("/api/stripe/labor-day-trial/eligibility", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured." });
      }
      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        return res.status(503).json({ message: "The Labor Day trial is not configured." });
      }
      const { inviteToken } = req.body as { inviteToken?: string };
      if (!verifyLaborDayInviteToken(inviteToken, secret)) {
        return res.status(403).json({
          eligible: false,
          message: "This private trial link is invalid or has expired.",
        });
      }

      const reason = await getTrialIneligibilityReason(stripe, req.user!.id);
      if (reason) {
        return res.status(403).json({ eligible: false, message: reason });
      }

      return res.json({
        eligible: true,
        trialDays: TRIAL_DAYS,
        accessToken: createTrialAccessToken(req.user!.id, secret),
      });
    } catch (error: any) {
      console.error("Trial eligibility error:", error);
      return res.status(500).json({ message: "Could not verify trial eligibility." });
    }
  });

  app.post("/api/stripe/create-checkout-session", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured. Please add your STRIPE_SECRET_KEY." });
      }

      const activeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_TEST;
      const isTestMode = activeKey?.startsWith("sk_test_");
      const { billingPeriod, trialAccessToken, inviteToken } = req.body as {
        billingPeriod?: "monthly" | "annual";
        trialAccessToken?: string;
        inviteToken?: string;
      };
      const isAnnual = billingPeriod === "annual";
      const isTrialCheckout = Boolean(trialAccessToken);

      const PRICES = {
        live:  { monthly: "price_1TObbDHsPecpDcHaiPuYgtps", annual: "price_1TObbEHsPecpDcHaS5ExBPdP" },
        test:  { monthly: "price_1TObbSHsPecpDcHamotiKcOF", annual: "price_1TObbTHsPecpDcHaTOnraJzw" },
      };
      const priceId = isTestMode
        ? PRICES.test[isAnnual ? "annual" : "monthly"]
        : PRICES.live[isAnnual ? "annual" : "monthly"];

      if (!priceId) {
        return res.status(503).json({ message: "Stripe price not configured." });
      }

      const userId = req.user!.id;
      const baseUrl = getBaseUrl(req);
      const storage = await storagePromise;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found." });

      let customerId = user.stripeCustomerId || undefined;
      if (isTrialCheckout) {
        const secret = process.env.SESSION_SECRET;
        if (!secret || !verifyTrialAccessToken(trialAccessToken, userId, secret)) {
          return res.status(403).json({ message: "This trial invitation is invalid or has expired." });
        }
        if (!verifyLaborDayInviteToken(inviteToken, secret)) {
          return res.status(403).json({ message: "This private trial link is invalid or has expired." });
        }
        const reason = await getTrialIneligibilityReason(stripe, userId);
        if (reason) {
          return res.status(403).json({ message: reason });
        }
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: `${user.firstName} ${user.lastName}`.trim(),
            metadata: { userId: String(userId) },
          }, {
            idempotencyKey: `trial-customer:${LABOR_DAY_CAMPAIGN}:${userId}`,
          });
          customerId = customer.id;
          await storage.updateUser(userId, { stripeCustomerId: customerId } as any);
        }

        const priorSessions = await stripe.checkout.sessions.list({
          customer: customerId,
          limit: 100,
        });
        const priorCampaignSession = priorSessions.data.find(
          (candidate) => candidate.metadata?.trialCampaign === LABOR_DAY_CAMPAIGN
            && candidate.mode === "subscription"
            && candidate.status !== "expired",
        );
        if (priorCampaignSession?.status === "complete") {
          return res.status(403).json({ message: "This account has already claimed the private trial offer." });
        }
        if (priorCampaignSession?.status === "open" && priorCampaignSession.url) {
          return res.json({ url: priorCampaignSession.url });
        }
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        ...(customerId ? { customer: customerId } : {}),
        ...(isTrialCheckout
          ? {
              payment_method_collection: "always",
              subscription_data: {
                trial_period_days: TRIAL_DAYS,
                trial_settings: {
                  end_behavior: { missing_payment_method: "cancel" },
                },
                metadata: {
                  userId: String(userId),
                  trialCampaign: LABOR_DAY_CAMPAIGN,
                },
              },
            }
          : {}),
        currency: "usd",
        locale: "en",
        adaptive_pricing: { enabled: false },
        success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/profile`,
        client_reference_id: String(userId),
        metadata: {
          userId: String(userId),
          ...(isTrialCheckout ? { trialCampaign: LABOR_DAY_CAMPAIGN } : {}),
        },
      } as any, isTrialCheckout
        ? { idempotencyKey: `trial-checkout:${LABOR_DAY_CAMPAIGN}:${userId}` }
        : undefined);

      if (!isTrialCheckout) {
        await storage.createPayment({
          userId,
          stripeSessionId: session.id,
          amount: session.amount_total || 0,
          currency: session.currency || "usd",
          status: "pending",
        });
      }

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: "Stripe is not configured" });
    }

    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured - rejecting webhook");
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    if (!sig) {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent((req as any).rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    const storage = await storagePromise;
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

    try {
      switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ? parseInt(session.client_reference_id) : null;

        if (userId) {
          if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            await syncSubscriptionToUser(stripe, sub, userId, { retryOnEmailFailure: true });
          }

          if (session.metadata?.trialCampaign !== LABOR_DAY_CAMPAIGN) {
            await storage.updatePaymentStatus(session.id, "paid", session.payment_intent as string);
          }
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await storage.updatePaymentStatus(session.id, "expired");
        break;
      }

      // Fires every billing cycle — keep subscriptionEndDate up to date and send renewal email
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          const subscriptionItem = sub.items.data[0];
          const isTrialConversion = Boolean(
            sub.status === "active"
            && sub.trial_end
            && subscriptionItem
            && Math.abs(subscriptionItem.current_period_start - sub.trial_end) <= 300,
          );
          await syncSubscriptionToUser(stripe, sub, user.id, { retryOnEmailFailure: true });
          const endDate = new Date(
            (subscriptionItem?.current_period_end || sub.trial_end || sub.cancel_at || sub.created) * 1000,
          );
          console.log(`Subscription updated for user ${user.id}. Status: ${sub.status}. Next end: ${endDate}`);

          // Send renewal confirmation email when the subscription is active and
          // the latest invoice confirms this was a billing cycle renewal.
          // Fetch the invoice to get the authoritative amount_paid.
          if (sub.status === "active" && sub.latest_invoice && resend && !isTrialConversion) {
            const invoiceId = typeof sub.latest_invoice === "string"
              ? sub.latest_invoice
              : sub.latest_invoice.id;
            const invoice = await stripe.invoices.retrieve(invoiceId);
            if (
              invoice.billing_reason === "subscription_cycle"
              && await storage.claimRenewalEmail(user.id, invoice.id)
            ) {
              const amountDollars = (invoice.amount_paid / 100).toFixed(2);
              const interval = getBillingPeriodFromSubscription(sub);
              const nextBillingDate = endDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });

              try {
                const emailResult = await resend.emails.send({
                  from: "GrantFind <noreply@grantfind.io>",
                  to: user.email,
                  subject: "Your GrantFind Pro subscription has renewed",
                  html: `<p>Hi ${user.firstName},</p>
<p>Your GrantFind Pro ${interval} subscription has successfully renewed for <strong>$${amountDollars}</strong>.</p>
<p>Your next billing date is <strong>${nextBillingDate}</strong>.</p>
<p>You can manage your subscription from your <a href="https://grantfind.replit.app/profile">profile page</a>.</p>
<p>Thank you for continuing to use GrantFind!</p>
<p>– The GrantFind Team</p>`,
                });
                if (emailResult.error) {
                  throw new Error(emailResult.error.message);
                }
                console.log(`Renewal confirmation email sent to user ${user.id} ($${amountDollars} ${interval})`);
              } catch (emailError) {
                await storage.releaseRenewalEmail(user.id, invoice.id);
                console.error("Renewal confirmation email failed:", emailError);
                throw emailError;
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (
          user
          && sub.trial_end
          && !user.trialReminderSentAt
          && await storage.claimTrialReminderEmail(user.id)
        ) {
          const sent = await sendTrialEndingSoonEmail(
            user.email,
            user.firstName,
            new Date(sub.trial_end * 1000),
            getBillingPeriodFromSubscription(sub),
          );
          if (!sent) {
            await storage.updateUser(user.id, { trialReminderSentAt: null } as any);
            throw new Error("Trial-ending reminder email delivery failed.");
          }
        }
        break;
      }

      // Persist successful renewal invoices so financial reporting includes recurring payments.
      // Renewal email remains in customer.subscription.updated to avoid duplicates.
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === "subscription_cycle") {
          await recordPaidInvoice(invoice);
          console.log(`Invoice paid for subscription renewal — customer ${invoice.customer}, amount $${(invoice.amount_paid / 100).toFixed(2)}`);
        }
        break;
      }

      // Fires when subscription is cancelled or fully expired
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          await storage.updateUser(user.id, {
            subscriptionTier: "free",
            stripeSubscriptionId: null,
            subscriptionEndDate: null,
            subscriptionStatus: "canceled",
            subscriptionCancelAtPeriodEnd: false,
          } as any);
          console.log(`User ${user.id} downgraded to free — subscription ended.`);

          // Send cancellation email
          if (resend) {
            await resend.emails.send({
              from: "GrantFind <noreply@grantfind.io>",
              to: user.email,
              subject: "Your GrantFind Pro subscription has ended",
              html: `<p>Hi ${user.firstName},</p>
<p>Your GrantFind Pro subscription has ended. You have been moved to the Free plan.</p>
<p>You can resubscribe anytime from your <a href="https://grantfind.replit.app/profile">profile page</a>.</p>
<p>– The GrantFind Team</p>`,
            }).catch(console.error);
          }
        }
        break;
      }

      // Fires when a renewal payment fails
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user && resend) {
          await resend.emails.send({
            from: "GrantFind <noreply@grantfind.io>",
            to: user.email,
            subject: "Action required: GrantFind payment failed",
            html: `<p>Hi ${user.firstName},</p>
<p>We were unable to process your GrantFind Pro subscription payment.</p>
<p>Please update your payment method to keep your Pro access: <a href="https://grantfind.replit.app/profile">Update Payment</a>.</p>
<p>If payment is not resolved, your account will be downgraded to the Free plan.</p>
<p>– The GrantFind Team</p>`,
          }).catch(console.error);
          console.log(`Payment failed notification sent to user ${user.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Stripe webhook processing failed for ${event.id}:`, error);
      return res.status(500).json({ message: "Webhook processing failed; retry required." });
    }

    res.json({ received: true });
  });

  app.get("/api/stripe/session-status", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const sessionId = req.query.session_id as string;
      if (!sessionId) {
        return res.status(400).json({ message: "session_id is required" });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const sessionUserId = session.client_reference_id;
      if (!sessionUserId || parseInt(sessionUserId) !== req.user!.id) {
        return res.status(403).json({ message: "You don't have access to this payment session" });
      }

      const storage = await storagePromise;
      const payment = await storage.getPaymentBySessionId(sessionId);

      let responseStatus: string = session.payment_status || session.status || "unknown";
      if (session.status === "complete" && session.subscription) {
        const userId = session.client_reference_id ? parseInt(session.client_reference_id) : null;
        if (userId) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscriptionToUser(stripe, subscription, userId);
          responseStatus = subscription.status === "trialing" ? "trialing" : "paid";
          if (session.metadata?.trialCampaign !== LABOR_DAY_CAMPAIGN) {
            await storage.updatePaymentStatus(sessionId, "paid", (session.payment_intent as string) || undefined);
          }
        }
      }

      res.json({
        status: responseStatus,
        trialEndsAt: session.subscription && responseStatus === "trialing"
          ? (await stripe.subscriptions.retrieve(session.subscription as string)).trial_end
          : null,
        customerEmail: session.customer_details?.email,
        amountTotal: session.amount_total,
        currency: session.currency,
        paymentRecord: payment,
      });
    } catch (error: any) {
      console.error("Session status error:", error);
      res.status(500).json({ message: error.message || "Failed to get session status" });
    }
  });

  // Cancel subscription — works with or without Stripe Customer Portal
  app.post("/api/stripe/cancel-subscription", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storage = await storagePromise;
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripeSubscriptionId = (user as any).stripeSubscriptionId;

      if (stripeSubscriptionId) {
        // Cancel via Stripe so webhook fires and cleans up properly
        const stripe = getStripe();
        if (stripe) {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          if (subscription.status === "trialing") {
            const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
              cancel_at_period_end: true,
            });
            await syncSubscriptionToUser(stripe, updated, user.id);
            return res.json({
              message: "Your trial has been cancelled. Premium access will remain available until the trial ends, and you will not be charged.",
              accessEndsAt: updated.trial_end ? new Date(updated.trial_end * 1000).toISOString() : null,
            });
          }
          await stripe.subscriptions.cancel(stripeSubscriptionId);
          return res.json({ message: "Subscription cancelled successfully." });
        }
      }

      // Fallback: no Stripe subscription (manually upgraded) — downgrade directly
      await storage.updateUser(req.user!.id, {
        subscriptionTier: "free",
        stripeSubscriptionId: null,
        subscriptionEndDate: null,
        subscriptionStartDate: null,
      } as any);

      const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
      if (resend && user) {
        await resend.emails.send({
          from: "GrantFind <noreply@grantfind.io>",
          to: user.email,
          subject: "Your GrantFind Pro subscription has been cancelled",
          html: `<p>Hi ${user.firstName},</p>
<p>Your GrantFind Pro subscription has been cancelled. You now have access to the Free plan.</p>
<p>You can resubscribe anytime from your <a href="https://grantfind.replit.app/profile">profile page</a>.</p>
<p>– The GrantFind Team</p>`,
        }).catch(console.error);
      }

      return res.json({ message: "Subscription cancelled successfully." });
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ message: error.message || "Failed to cancel subscription" });
    }
  });

  // Opens Stripe Customer Portal so paid users can cancel, change plan, or update payment
  app.post("/api/stripe/customer-portal", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured." });
      }

      const storage = await storagePromise;
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const stripeCustomerId = (user as any).stripeCustomerId;
      if (!stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription found. Please subscribe first." });
      }

      const baseUrl = getBaseUrl(req);
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${baseUrl}/profile`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error("Customer portal error:", error);
      res.status(500).json({ message: error.message || "Failed to open subscription management" });
    }
  });

  app.get("/api/stripe/config", (req: Request, res: Response) => {
    res.json({
      configured: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID,
    });
  });
}
