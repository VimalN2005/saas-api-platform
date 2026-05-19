const router = require('express').Router();
const Stripe = require('stripe');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Stripe webhook signature failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Store webhook event
  await prisma.webhookEvent.create({
    data: { provider: 'stripe', eventType: event.type, payload: event },
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { organizationId, plan } = session.metadata;

        await prisma.subscription.update({
          where: { organizationId },
          data: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan,
            status: 'ACTIVE',
          },
        });
        logger.info(`Subscription activated: org=${organizationId} plan=${plan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const dbSub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });

        if (dbSub) {
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
              status: sub.status.toUpperCase(),
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan: 'FREE', status: 'CANCELED', stripeSubscriptionId: null },
        });
        logger.info(`Subscription canceled: stripeSubId=${sub.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripeCustomerId: invoice.customer },
          data: { status: 'PAST_DUE' },
        });
        break;
      }
    }

    // Mark as processed
    await prisma.webhookEvent.updateMany({
      where: { provider: 'stripe', payload: { path: ['id'], equals: event.id } },
      data: { processed: true, processedAt: new Date() },
    });

  } catch (err) {
    logger.error('Webhook processing error:', err);
    await prisma.webhookEvent.updateMany({
      where: { provider: 'stripe', payload: { path: ['id'], equals: event.id } },
      data: { error: err.message },
    });
  }

  res.json({ received: true });
});

module.exports = router;
