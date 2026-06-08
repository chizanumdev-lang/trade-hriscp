import { prisma } from './src/db.js';

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, organizationId: true, role: true }});
  console.log("Users:");
  console.table(users);

  const depts = await prisma.department.findMany({ select: { id: true, name: true, organizationId: true }});
  console.log("Departments:");
  console.table(depts);

  const wfs = await prisma.approvalWorkflow.findMany({ select: { id: true, name: true, organizationId: true }});
  console.log("Workflows:");
  console.table(wfs);

  await prisma.$disconnect();
}

check().catch(console.error);
