const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/billing.controller');

router.use(authenticate);

/**
 * @swagger
 * /billing/{orgId}:
 *   get:
 *     summary: Get current subscription
 *     tags: [Billing]
 */
router.get('/:orgId', requireAdmin, ctrl.getSubscription);
router.get('/:orgId/invoices', requireAdmin, ctrl.getInvoices);

router.post('/:orgId/checkout',
  requireAdmin,
  [body('plan').isIn(['PRO', 'ENTERPRISE'])],
  validate,
  ctrl.createCheckoutSession
);

router.post('/:orgId/portal', requireAdmin, ctrl.createPortalSession);

module.exports = router;
