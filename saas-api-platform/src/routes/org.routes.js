const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, requireOrgMember, requireAdmin, requireOwner } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/org.controller');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /orgs/{orgId}:
 *   get:
 *     summary: Get organization details
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 */
router.get('/:orgId', requireOrgMember(), ctrl.getOrg);

router.patch('/:orgId',
  requireAdmin,
  [body('name').optional().trim().notEmpty()],
  validate,
  ctrl.updateOrg
);

// Members
router.get('/:orgId/members', requireOrgMember(), ctrl.getMembers);

router.post('/:orgId/members/invite',
  requireAdmin,
  [
    body('email').isEmail().normalizeEmail(),
    body('role').optional().isIn(['ADMIN', 'MEMBER', 'VIEWER']),
  ],
  validate,
  ctrl.inviteMember
);

router.post('/invites/:token/accept', ctrl.acceptInvite);

router.patch('/:orgId/members/:memberId/role',
  requireAdmin,
  [body('role').isIn(['ADMIN', 'MEMBER', 'VIEWER'])],
  validate,
  ctrl.updateMemberRole
);

router.delete('/:orgId/members/:memberId', requireAdmin, ctrl.removeMember);

module.exports = router;
