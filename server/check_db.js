import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true
      }
    });
    console.log(`Total users: ${users.length}`);
    console.log(users.map(u => `${u.email} - ${u.role}`).join('\n'));

    const departments = await prisma.department.findMany();
    console.log(`Total departments: ${departments.length}`);
    console.log(departments.map(d => `${d.name} (${d.id})`).join('\n'));

    const orgs = await prisma.organization.findMany();
    console.log(`Total orgs: ${orgs.length}`);
    console.log(orgs.map(o => o.name).join('\n'));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
