import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedUsers() {
  const users = [
    {
      email: 'credk@gmail.com',
      password: '12345678',
      fullName: 'Credk User',
      role: 'Traffic_Controller',
    },
    {
      email: 'y@gmail.com',
      password: '87654321',
      fullName: 'Y User',
      role: 'Driver',
    },
  ];

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);

    const result = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash: hash,
        fullName: user.fullName,
        role: user.role,
      },
      create: {
        email: user.email,
        passwordHash: hash,
        fullName: user.fullName,
        role: user.role,
        isActive: true,
        failedLoginCount: 0,
      },
    });

    console.log(`✅ ${result.email} (${result.role}) — id: ${result.id}`);
  }

  await prisma.$disconnect();
  console.log('\nDone!');
}

seedUsers().catch(async (err) => {
  console.error('Error:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
