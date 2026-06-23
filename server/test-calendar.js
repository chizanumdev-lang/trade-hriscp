import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const yearStart = new Date('2026-01-01');
  const yearEnd = new Date('2026-12-31T23:59:59.999Z');
  
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart }
    },
    include: { employee: true }
  });
  
  console.log(JSON.stringify(leaves, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
