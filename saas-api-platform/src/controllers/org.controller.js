const crypto = require('crypto');
const { prisma } = require('../config/database');
const { sendInviteEmail } = require('../services/email.service');
const { AppError } = require('../utils/AppError');

// ===== GET ORG =====
async function getOrg(req, res, next) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.orgId },
      include: {
        subscription: true,
        _count: { select: { members: true, apiKeys: true } },
      },
    });
    if (!org) throw new AppError('Organization not found', 404);
    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
}

// ===== UPDATE ORG =====
async function updateOrg(req, res, next) {
  try {
    const { name, domain } = req.body;
    const org = await prisma.organization.update({
      where: { id: req.params.orgId },
      data: { name, domain },
    });
    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
}

// ===== GET MEMBERS =====
async function getMembers(req, res, next) {
  try {
    const members = await prisma.orgMember.findMany({
      where: { organizationId: req.params.orgId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

// ===== INVITE MEMBER =====
async function inviteMember(req, res, next) {
  try {
    const { email, role = 'MEMBER' } = req.body;
    const { orgId } = req.params;

    // Check if already member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.orgMember.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
      });
      if (existingMember) throw new AppError('User is already a member', 409);
    }

    // Check pending invite
    const pendingInvite = await prisma.orgInvite.findFirst({
      where: { email, organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (pendingInvite) throw new AppError('Invite already sent to this email', 409);

    const invite = await prisma.orgInvite.create({
      data: {
        email,
        role,
        organizationId: orgId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: { organization: true },
    });

    await sendInviteEmail(email, invite.token, invite.organization.name);

    res.status(201).json({ message: 'Invite sent successfully', invite });
  } catch (err) {
    next(err);
  }
}

// ===== ACCEPT INVITE =====
async function acceptInvite(req, res, next) {
  try {
    const { token } = req.params;

    const invite = await prisma.orgInvite.findUnique({
      where: { token },
    });

    if (!invite || invite.expiresAt < new Date()) {
      throw new AppError('Invalid or expired invite', 400);
    }
    if (invite.acceptedAt) throw new AppError('Invite already accepted', 400);

    const user = await prisma.user.findUnique({ where: { email: invite.email } });
    if (!user) throw new AppError('Please register first before accepting invite', 400);
    if (user.id !== req.user.id) throw new AppError('This invite is for a different email', 403);

    await prisma.$transaction(async (tx) => {
      await tx.orgMember.create({
        data: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
      });
      await tx.orgInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    });

    res.json({ message: 'Invite accepted successfully' });
  } catch (err) {
    next(err);
  }
}

// ===== UPDATE MEMBER ROLE =====
async function updateMemberRole(req, res, next) {
  try {
    const { orgId, memberId } = req.params;
    const { role } = req.body;

    if (memberId === req.user.id) {
      throw new AppError('Cannot change your own role', 400);
    }

    const member = await prisma.orgMember.findFirst({
      where: { userId: memberId, organizationId: orgId },
    });
    if (!member) throw new AppError('Member not found', 404);
    if (member.role === 'OWNER') throw new AppError('Cannot change owner role', 400);

    const updated = await prisma.orgMember.update({
      where: { id: member.id },
      data: { role },
    });

    res.json({ member: updated });
  } catch (err) {
    next(err);
  }
}

// ===== REMOVE MEMBER =====
async function removeMember(req, res, next) {
  try {
    const { orgId, memberId } = req.params;

    if (memberId === req.user.id) {
      throw new AppError('Cannot remove yourself', 400);
    }

    const member = await prisma.orgMember.findFirst({
      where: { userId: memberId, organizationId: orgId },
    });
    if (!member) throw new AppError('Member not found', 404);
    if (member.role === 'OWNER') throw new AppError('Cannot remove owner', 400);

    await prisma.orgMember.delete({ where: { id: member.id } });
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOrg, updateOrg, getMembers, inviteMember, acceptInvite, updateMemberRole, removeMember };
