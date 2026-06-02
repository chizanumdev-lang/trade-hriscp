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
  const employeesWithTasks = await prisma.employee.findMany({
    where: {
      onboardingTasks: {
        some: {}
      }
    }
  });

  console.log(`Found ${employeesWithTasks.length} employees with tasks. Setting onboardingStatus to 'in_progress'.`);

  for (const emp of employeesWithTasks) {
    await prisma.employee.update({
      where: { id: emp.id },
      data: { onboardingStatus: 'in_progress' }
    });
  }
  console.log("Done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
