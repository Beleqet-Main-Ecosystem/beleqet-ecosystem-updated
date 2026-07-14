const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.paymentGateway.create({
    data: {
      provider: 'stripe',
      name: 'Stripe',
      isActive: true,
      supportedCurrencies: ['ETB', 'USD', 'EUR', 'GBP'],
      config: {},
    },
  });
  console.log('Payment gateway seeded');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });