const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Checking database for demo users and chat room...');

  // 1. Ensure test users exist
  const passwordHash = await bcrypt.hash('Password123!', 10);
  
  // Employer
  const employer = await prisma.user.upsert({
    where: { email: 'employer@beleqet.demo' },
    update: {},
    create: {
      email: 'employer@beleqet.demo',
      passwordHash,
      firstName: 'Beleqet',
      lastName: 'Employer',
      role: 'EMPLOYER',
      emailVerified: true,
    },
  });

  // Seeker / Freelancer
  const seeker = await prisma.user.upsert({
    where: { email: 'seeker@beleqet.demo' },
    update: {},
    create: {
      email: 'seeker@beleqet.demo',
      passwordHash,
      firstName: 'Abebe',
      lastName: 'Bikila',
      role: 'FREELANCER',
      emailVerified: true,
    },
  });

  console.log(`✅ Employer: ${employer.email} (${employer.id})`);
  console.log(`✅ Seeker: ${seeker.email} (${seeker.id})`);

  // 2. Create Chat Room
  // Check if a room already exists for these participants
  const existingRoom = await prisma.chatRoom.findFirst({
    where: {
      participants: {
        some: { userId: employer.id }
      },
      AND: {
        participants: {
          some: { userId: seeker.id }
        }
      }
    },
    include: { participants: true }
  });

  let room;
  if (existingRoom && existingRoom.participants.length === 2) {
    room = existingRoom;
    console.log(`ℹ️ Found existing ChatRoom: ${room.id}`);
  } else {
    room = await prisma.chatRoom.create({
      data: {
        participants: {
          create: [{ userId: employer.id }, { userId: seeker.id }]
        }
      }
    });
    console.log(`✅ Created new ChatRoom: ${room.id}`);
  }

  // 3. Print URLs
  console.log('\n--- CHAT PAGE DEMO LINKS ---');
  console.log('Employer Chat Link:');
  console.log(`http://localhost:3000/chat?room=${room.id}&recipient=${seeker.id}&lang=en`);
  console.log('Seeker Chat Link:');
  console.log(`http://localhost:3000/chat?room=${room.id}&recipient=${employer.id}&lang=en`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
