const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@example.com',
      passwordHash,
      emailVerified: true,
    },
  });

  // Create demo org
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
      members: {
        create: { userId: user.id, role: 'OWNER' },
      },
    },
  });

  // Create subscription
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      stripeCustomerId: `pending_${org.id}`,
      plan: 'FREE',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Seed complete!');
  console.log('📧 Email: demo@example.com');
  console.log('🔑 Password: password123');
  console.log(`🏢 Org ID: ${org.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
