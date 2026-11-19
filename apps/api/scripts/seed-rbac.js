const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));
const Redis = require('ioredis');

const prisma = new PrismaClient();
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT) || 6380 });

async function seedRbac() {
  console.log('Seeding RBAC permissions...');
  const permissionsData = [
    { action: 'manage:roles', description: 'Manage roles and permissions' },
    { action: 'manage:users', description: 'Manage user accounts' },
    { action: 'manage:jobs', description: 'Manage all jobs' },
    { action: 'create:jobs', description: 'Create and post jobs' },
    { action: 'view:stats', description: 'View platform statistics' },
    { action: 'manage:billing', description: 'Manage subscriptions and billing' },
    { action: 'manage:kyc', description: 'Manage KYC verification' },
    { action: 'manage:disputes', description: 'Manage contracts and disputes' },
    { action: 'manage:db', description: 'Manage database indexing' },
  ];

  const permissions = await Promise.all(
    permissionsData.map(p => prisma.permission.upsert({
      where: { action: p.action },
      update: {},
      create: p,
    }))
  );

  const permMap = Object.fromEntries(permissions.map(p => [p.action, { id: p.id }]));

  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {
      permissions: { connect: Object.values(permMap) }
    },
    create: {
      name: 'ADMIN',
      description: 'Super Administrator',
      isSystem: true,
      permissions: { connect: Object.values(permMap) },
    }
  });

  await prisma.role.upsert({
    where: { name: 'EMPLOYER' },
    update: {
      permissions: { connect: [permMap['create:jobs'], permMap['manage:disputes']] }
    },
    create: {
      name: 'EMPLOYER',
      description: 'Employer who posts jobs',
      isSystem: true,
      permissions: { connect: [permMap['create:jobs'], permMap['manage:disputes']] },
    }
  });

  await prisma.role.upsert({
    where: { name: 'FREELANCER' },
    update: {
      permissions: { connect: [permMap['manage:disputes']] }
    },
    create: {
      name: 'FREELANCER',
      description: 'Freelancer providing services',
      isSystem: true,
      permissions: { connect: [permMap['manage:disputes']] },
    }
  });

  // Connect ADMIN role to any existing user with role 'ADMIN'
  const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  for (const admin of adminUsers) {
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        rbacRoles: {
          connect: { name: 'ADMIN' }
        }
      }
    });
    console.log(`Connected ADMIN role to ${admin.email} (${admin.id})`);
  }

  // Clear stale permission cache in Redis
  const keys = await redis.keys('user_permissions:*');
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`Cleared ${keys.length} stale permission cache keys in Redis:`, keys);
  } else {
    console.log('No stale permission cache keys found in Redis.');
  }

  console.log('RBAC initialization complete.');
}

seedRbac()
  .catch((err) => {
    console.error('Error seeding RBAC:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
