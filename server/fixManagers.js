import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany();
  let hrAdminEmpId = null;

  for (const dept of depts) {
    if (dept.headEmployeeId) {
      if (!hrAdminEmpId) {
        const hrAdmin = await prisma.user.findFirst({
          where: { organizationId: dept.organizationId, role: 'HR_ADMIN', employeeId: { not: null } }
        });
        if (hrAdmin) hrAdminEmpId = hrAdmin.employeeId;
      }
      
      const head = await prisma.employee.findUnique({ where: { id: dept.headEmployeeId }});
      if (head) {
        console.log(`Fixing head of department ${dept.name}: ${head.fullName}`);
        await prisma.employee.update({
          where: { id: dept.headEmployeeId },
          data: { managerId: hrAdminEmpId }
        });
      }
      
      // Also ensure all other employees in the dept report to the head
      await prisma.employee.updateMany({
        where: { departmentId: dept.id, id: { not: dept.headEmployeeId } },
        data: { managerId: dept.headEmployeeId }
      });
    }
  }

  // Find any employee reporting to themselves and fix it
  const selfReporting = await prisma.employee.findMany();
  for (const emp of selfReporting) {
    if (emp.managerId === emp.id) {
       console.log(`Fixing self-reporting employee: ${emp.fullName}`);
       await prisma.employee.update({
          where: { id: emp.id },
          data: { managerId: hrAdminEmpId }
       });
    }
  }
  
  console.log("Done fixing managers");
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
