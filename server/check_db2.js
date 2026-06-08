import { prisma } from './src/db.js';
import fs from 'fs';

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, organizationId: true, role: true }});
  const depts = await prisma.department.findMany({ select: { id: true, name: true, organizationId: true }});
  const wfs = await prisma.approvalWorkflow.findMany({ select: { id: true, name: true, organizationId: true }});

  fs.writeFileSync('db_out.json', JSON.stringify({ users, depts, wfs }, null, 2));

  await prisma.$disconnect();
}

check().catch(e => {
  fs.writeFileSync('db_out.json', JSON.stringify({ error: e.message }));
  process.exit(1);
});
