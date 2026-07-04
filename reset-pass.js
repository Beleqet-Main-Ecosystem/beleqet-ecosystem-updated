const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'bisrat.freelancer@beleqet.com';
  const newPassword = 'SecurePass123!';
  const hash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { email },
    data: { passwordHash: hash }
  });

  console.log('Password reset to SecurePass123!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
