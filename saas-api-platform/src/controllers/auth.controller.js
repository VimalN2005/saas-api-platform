const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { generateTokens, verifyRefreshToken } = require('../services/token.service');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email.service');
const { AppError } = require('../utils/AppError');

// ===== REGISTER =====
async function register(req, res, next) {
  try {
    const { name, email, password, orgName } = req.body;

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already registered', 409);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    // Create org slug
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();

    // Create user + org + membership in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, verifyToken },
      });

      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          members: {
            create: { userId: user.id, role: 'OWNER' },
          },
        },
      });

      // Create free Stripe subscription placeholder
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          stripeCustomerId: `pending_${org.id}`,
          plan: 'FREE',
          status: 'ACTIVE',
        },
      });

      return { user, org };
    });

    // Send verification email
    await sendVerificationEmail(email, verifyToken);

    const { accessToken, refreshToken } = await generateTokens(result.user.id);

    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      accessToken,
      refreshToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        emailVerified: result.user.emailVerified,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ===== LOGIN =====
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { organization: true },
          take: 1,
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    const { accessToken, refreshToken } = await generateTokens(user.id);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ===== REFRESH TOKEN =====
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required', 400);

    const userId = await verifyRefreshToken(refreshToken);
    const tokens = await generateTokens(userId);

    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

// ===== LOGOUT =====
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

// ===== VERIFY EMAIL =====
async function verifyEmail(req, res, next) {
  try {
    const { token } = req.params;
    const user = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (!user) throw new AppError('Invalid or expired verification token', 400);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null },
    });

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
}

// ===== FORGOT PASSWORD =====
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success (security)
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetExpires },
      });

      await sendPasswordResetEmail(email, resetToken);
    }

    res.json({ message: 'If email exists, password reset link has been sent' });
  } catch (err) {
    next(err);
  }
}

// ===== RESET PASSWORD =====
async function resetPassword(req, res, next) {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: new Date() },
      },
    });

    if (!user) throw new AppError('Invalid or expired reset token', 400);

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetExpires: null },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

// ===== GET ME =====
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        avatarUrl: true,
        createdAt: true,
        memberships: {
          include: {
            organization: {
              include: { subscription: true },
            },
          },
        },
      },
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, verifyEmail, forgotPassword, resetPassword, getMe };
