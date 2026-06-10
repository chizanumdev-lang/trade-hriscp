const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const e = await prisma.employee.findFirst({ where: { employmentStatus: 'PROBATION' } });
  console.log('e.probationStartDate:', e.probationStartDate);
  console.log('type:', typeof e.probationStartDate);
  if (e.probationStartDate) console.log('toString:', e.probationStartDate.toString());
}
main().finally(() => prisma.$disconnect());
