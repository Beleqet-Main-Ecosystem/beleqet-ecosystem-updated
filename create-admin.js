const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('SecurePass123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@beleqet.com' },
    update: {},
    create: {
      email: 'admin@beleqet.com',
      passwordHash: hash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created! (admin@beleqet.com / SecurePass123!)');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
