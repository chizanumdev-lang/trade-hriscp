import { prisma } from './src/db.js';

async function main() {
  const employees = await prisma.employee.findMany();
  console.log(employees);
}
main();
