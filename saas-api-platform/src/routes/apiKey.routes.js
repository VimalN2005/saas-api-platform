const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/apiKey.controller');

router.use(authenticate);

/**
 * @swagger
 * /api-keys/{orgId}:
 *   get:
 *     summary: List all API keys for an organization
 *     tags: [API Keys]
 *   post:
 *     summary: Create a new API key
 *     tags: [API Keys]
 */
router.get('/:orgId', requireAdmin, ctrl.listApiKeys);

router.post('/:orgId',
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('scopes').optional().isArray(),
    body('expiresAt').optional().isISO8601(),
  ],
  validate,
  ctrl.createApiKey
);

router.delete('/:orgId/:keyId', requireAdmin, ctrl.revokeApiKey);

module.exports = router;
