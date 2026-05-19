const Stripe = require('stripe');
const { prisma } = require('../config/database');
const { AppError } = require('../utils/AppError');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  FREE: { priceId: null, name: 'Free', price: 0 },
  PRO: { priceId: process.env.STRIPE_PRO_PRICE_ID, name: 'Pro', price: 29 },
  ENTERPRISE: { priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID, name: 'Enterprise', price: 99 },
};

// ===== GET SUBSCRIPTION =====
async function getSubscription(req, res, next) {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { organizationId: req.params.orgId },
    });
    if (!sub) throw new AppError('Subscription not found', 404);

    res.json({
      subscription: {
        plan: sub.plan,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        features: getPlanFeatures(sub.plan),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ===== CREATE CHECKOUT SESSION =====
async function createCheckoutSession(req, res, next) {
  try {
    const { plan, successUrl, cancelUrl } = req.body;
    const { orgId } = req.params;

    if (!PLANS[plan]?.priceId) {
      throw new AppError('Invalid plan or free plan selected', 400);
    }

    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });

    // Create or get Stripe customer
    let customerId = sub?.stripeCustomerId;
    if (!customerId || customerId.startsWith('pending_')) {
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: org.name,
        metadata: { organizationId: orgId },
      });
      customerId = customer.id;

      await prisma.subscription.update({
        where: { organizationId: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl || `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.APP_URL}/billing/cancel`,
      metadata: { organizationId: orgId, plan },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    next(err);
  }
}

// ===== CREATE PORTAL SESSION =====
async function createPortalSession(req, res, next) {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { organizationId: req.params.orgId },
    });

    if (!sub?.stripeCustomerId || sub.stripeCustomerId.startsWith('pending_')) {
      throw new AppError('No billing account found', 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.APP_URL}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
}

// ===== GET INVOICES =====
async function getInvoices(req, res, next) {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { organizationId: req.params.orgId },
    });

    if (!sub?.stripeCustomerId || sub.stripeCustomerId.startsWith('pending_')) {
      return res.json({ invoices: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: sub.stripeCustomerId,
      limit: 12,
    });

    res.json({
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        amount: inv.amount_paid / 100,
        currency: inv.currency,
        status: inv.status,
        date: new Date(inv.created * 1000),
        pdfUrl: inv.invoice_pdf,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ===== PLAN FEATURES =====
function getPlanFeatures(plan) {
  const features = {
    FREE: { apiKeys: 3, requestsPerMonth: 1000, teamMembers: 3, support: 'community' },
    PRO: { apiKeys: 20, requestsPerMonth: 50000, teamMembers: 20, support: 'email' },
    ENTERPRISE: { apiKeys: 100, requestsPerMonth: -1, teamMembers: -1, support: 'priority' },
  };
  return features[plan] || features.FREE;
}

module.exports = { getSubscription, createCheckoutSession, createPortalSession, getInvoices };
