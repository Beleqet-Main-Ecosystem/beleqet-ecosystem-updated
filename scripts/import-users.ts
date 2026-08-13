import { PrismaClient, UserRole } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function importUsers() {
  // Get input path from command line arguments, default to local json file
  const inputPath = process.argv[2] || 'users-migration.json';
  
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: JSON file not found at ${inputPath}`);
    console.log(`Usage: npx ts-node scripts/import-users.ts [path/to/users-migration.json]`);
    return;
  }

  const rawData = fs.readFileSync(inputPath, 'utf8');
  const users = JSON.parse(rawData);

  console.log(`Loaded ${users.length} users from JSON.`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const u of users) {
    try {
      // Create user
      const createdUser = await prisma.user.create({
        data: {
          id: u.id,
          email: u.email,
          passwordHash: u.passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role as UserRole,
          telegramId: u.telegramId,
          bio: u.bio,
          phone: u.phone,
          location: u.location,
          headline: u.headline,
          defaultResumeUrl: u.defaultResumeUrl,
          avatarUrl: u.avatarUrl,
          createdAt: new Date(u.createdAt)
        }
      });

      // Create company if applicable
      if (u.company) {
        await prisma.company.create({
          data: {
            id: u.company.id,
            name: u.company.name,
            location: u.company.location ?? null,
            website: u.company.website ?? null,
            userId: createdUser.id,
          },
        });
      }

      successCount++;
      if (successCount % 100 === 0) {
        console.log(`Imported ${successCount} users...`);
      }
    } catch (e) {
      console.error(`Failed to import user ${u.email}:`, e.message);
      errorCount++;
    }
  }

  console.log(`\nImport complete!`);
  console.log(`Successfully imported: ${successCount}`);
  console.log(`Failed to import: ${errorCount}`);
}

importUsers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
