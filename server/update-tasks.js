import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching tasks with null assignedTo...');
  const tasks = await prisma.onboardingTask.findMany({
    where: { assignedTo: null },
    include: { employee: true }
  });

  console.log(`Found ${tasks.length} tasks to update.`);

  let updatedCount = 0;
  for (const task of tasks) {
    if (task.employee && task.employee.fullName) {
      await prisma.onboardingTask.update({
        where: { id: task.id },
        data: { assignedTo: task.employee.fullName }
      });
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} tasks.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
