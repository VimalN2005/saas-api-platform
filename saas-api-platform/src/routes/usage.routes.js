const router = require('express').Router();
const { authenticate, requireOrgMember } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');

router.use(authenticate);

/**
 * @swagger
 * /usage/{orgId}:
 *   get:
 *     summary: Get API usage statistics
 *     tags: [Usage]
 */
router.get('/:orgId', requireOrgMember(), async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { from, to } = req.query;

    const start = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = to ? new Date(to) : new Date();

    const [total, byStatus, byEndpoint, recent] = await Promise.all([
      prisma.usageLog.count({ where: { organizationId: orgId, timestamp: { gte: start, lte: end } } }),
      prisma.usageLog.groupBy({
        by: ['statusCode'],
        where: { organizationId: orgId, timestamp: { gte: start, lte: end } },
        _count: true,
        orderBy: { statusCode: 'asc' },
      }),
      prisma.usageLog.groupBy({
        by: ['endpoint'],
        where: { organizationId: orgId, timestamp: { gte: start, lte: end } },
        _count: true,
        _avg: { responseTimeMs: true },
        orderBy: { _count: { endpoint: 'desc' } },
        take: 10,
      }),
      prisma.usageLog.findMany({
        where: { organizationId: orgId },
        orderBy: { timestamp: 'desc' },
        take: 50,
        select: {
          id: true, endpoint: true, method: true,
          statusCode: true, responseTimeMs: true, timestamp: true,
        },
      }),
    ]);

    res.json({
      summary: {
        totalRequests: total,
        period: { from: start, to: end },
      },
      byStatus,
      topEndpoints: byEndpoint,
      recentRequests: recent,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
