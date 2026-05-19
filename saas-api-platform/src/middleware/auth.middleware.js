const { verifyAccessToken } = require('../services/token.service');
const { prisma } = require('../config/database');
const { AppError } = require('../utils/AppError');

// ===== JWT AUTH =====
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

    if (!user) throw new AppError('User not found', 401);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// ===== ORG MEMBERSHIP CHECK =====
function requireOrgMember(allowedRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']) {
  return async (req, res, next) => {
    try {
      const { orgId } = req.params;

      const membership = await prisma.orgMember.findUnique({
        where: {
          userId_organizationId: { userId: req.user.id, organizationId: orgId },
        },
        include: { organization: true },
      });

      if (!membership) {
        throw new AppError('You are not a member of this organization', 403);
      }

      if (!allowedRoles.includes(membership.role)) {
        throw new AppError('Insufficient permissions', 403);
      }

      req.membership = membership;
      req.organization = membership.organization;
      next();
    } catch (err) {
      next(err);
    }
  };
}

const requireAdmin = requireOrgMember(['OWNER', 'ADMIN']);
const requireOwner = requireOrgMember(['OWNER']);

module.exports = { authenticate, requireOrgMember, requireAdmin, requireOwner };
