const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Logged-in user: none b
  const userA = { email: 'bemnetkebede069@gmail.com', id: '407a2deb-fec8-47dd-bd60-d9ab03815750' };
  // Other user who already has a key: Test test
  const userB = { email: 'test1@test.com', id: '29b5da9d-c8c6-48f2-8814-55a86ccf54a3' };

  console.log('🔄 Setting up chat room for logged-in user...');

  // Create Chat Room
  const existingRoom = await prisma.chatRoom.findFirst({
    where: {
      participants: {
        some: { userId: userA.id }
      },
      AND: {
        participants: {
          some: { userId: userB.id }
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
          create: [{ userId: userA.id }, { userId: userB.id }]
        }
      }
    });
    console.log(`✅ Created new ChatRoom: ${room.id}`);
  }

  console.log('\n--- CHAT PAGE DEMO LINKS FOR YOU ---');
  console.log('Window A (Your currently logged in user "none b"):');
  console.log(`http://localhost:3000/chat?room=${room.id}&recipient=${userB.id}&lang=en`);
  console.log('\nWindow B (To open in Incognito window - log in as test1@test.com):');
  console.log(`http://localhost:3000/chat?room=${room.id}&recipient=${userA.id}&lang=en`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
