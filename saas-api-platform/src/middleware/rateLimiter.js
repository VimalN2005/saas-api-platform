const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');

// ===== GLOBAL RATE LIMITER =====
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// ===== AUTH RATE LIMITER (stricter) =====
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again in 15 minutes' },
});

// ===== API KEY RATE LIMITER (Redis-based, per org) =====
async function apiKeyRateLimiter(req, res, next) {
  try {
    const redis = getRedis();
    const orgId = req.organization?.id;
    if (!orgId) return next();

    const plan = req.organization?.subscription?.plan || 'FREE';
    const limits = { FREE: 60, PRO: 600, ENTERPRISE: 6000 }; // per minute
    const limit = limits[plan];

    const key = `rate:${orgId}:${Math.floor(Date.now() / 60000)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));

    if (count > limit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        limit,
        resetAt: new Date((Math.floor(Date.now() / 60000) + 1) * 60000),
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { globalRateLimiter, authRateLimiter, apiKeyRateLimiter };
