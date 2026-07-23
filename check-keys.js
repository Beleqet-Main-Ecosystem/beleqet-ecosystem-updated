const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  });

  console.log('--- ALL USERS KEY CHECK ---');
  for (const user of users) {
    const key = await prisma.userPublicKey.findUnique({
      where: { userId: user.id }
    });
    console.log(`User: ${user.firstName} ${user.lastName} (${user.email}) -> Key present: ${!!key}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
