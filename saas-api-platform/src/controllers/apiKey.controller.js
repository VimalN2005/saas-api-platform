const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { AppError } = require('../utils/AppError');

function generateApiKey() {
  const prefix = 'sk_live_';
  const secret = crypto.randomBytes(32).toString('hex');
  return { key: `${prefix}${secret}`, prefix: prefix + secret.slice(0, 8) };
}

// ===== CREATE API KEY =====
async function createApiKey(req, res, next) {
  try {
    const { name, scopes = [], expiresAt } = req.body;
    const { orgId } = req.params;

    // Check key limit per plan
    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    const limits = { FREE: 3, PRO: 20, ENTERPRISE: 100 };
    const count = await prisma.apiKey.count({ where: { organizationId: orgId, isActive: true } });

    if (count >= (limits[sub?.plan] || 3)) {
      throw new AppError(`API key limit reached for ${sub?.plan || 'FREE'} plan`, 403);
    }

    const { key, prefix } = generateApiKey();
    const keyHash = await bcrypt.hash(key, 10);

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        keyPrefix: prefix,
        scopes,
        organizationId: orgId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Return full key ONLY once
    res.status(201).json({
      message: 'API key created. Save this key — it will not be shown again.',
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key, // Full key shown only once
        prefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ===== LIST API KEYS =====
async function listApiKeys(req, res, next) {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { organizationId: req.params.orgId },
      select: {
        id: true, name: true, keyPrefix: true, scopes: true,
        isActive: true, lastUsedAt: true, expiresAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ apiKeys: keys });
  } catch (err) {
    next(err);
  }
}

// ===== REVOKE API KEY =====
async function revokeApiKey(req, res, next) {
  try {
    const { orgId, keyId } = req.params;

    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, organizationId: orgId },
    });
    if (!key) throw new AppError('API key not found', 404);

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    res.json({ message: 'API key revoked successfully' });
  } catch (err) {
    next(err);
  }
}

// ===== VALIDATE API KEY (for middleware use) =====
async function validateApiKey(apiKeyRaw) {
  const allKeys = await prisma.apiKey.findMany({
    where: { isActive: true },
    include: { organization: { include: { subscription: true } } },
  });

  for (const key of allKeys) {
    const match = await bcrypt.compare(apiKeyRaw, key.keyHash);
    if (match) {
      if (key.expiresAt && key.expiresAt < new Date()) return null;

      // Update last used
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });

      return key;
    }
  }
  return null;
}

module.exports = { createApiKey, listApiKeys, revokeApiKey, validateApiKey };
