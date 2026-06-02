import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    throw new Error("No organization found. Please seed organization first.");
  }

  const departments = await prisma.department.findMany();
  if (departments.length === 0) {
    console.log("No departments found. Creating departments...");
    const engDept = await prisma.department.create({ data: { name: "Engineering", description: "Tech team", status: "APPROVED" } });
    const hrDept = await prisma.department.create({ data: { name: "Human Resources", description: "HR team", status: "APPROVED" } });
    departments.push(engDept, hrDept);
  }

  console.log("Departments available:", departments.map(d => d.name));

  const nigerianEmployees = [
    { fullName: "Chinedu Okafor", email: "chinedu.okafor@tradevu.com", jobTitle: "Software Engineer", deptName: "Engineering" },
    { fullName: "Amina Yusuf", email: "amina.yusuf@tradevu.com", jobTitle: "Frontend Developer", deptName: "Engineering" },
    { fullName: "Folake Adebayo", email: "folake.adebayo@tradevu.com", jobTitle: "HR Manager", deptName: "Human Resources" },
    { fullName: "Emeka Nwosu", email: "emeka.nwosu@tradevu.com", jobTitle: "DevOps Engineer", deptName: "Engineering" },
    { fullName: "Ngozi Eze", email: "ngozi.eze@tradevu.com", jobTitle: "Recruiter", deptName: "Human Resources" },
    { fullName: "Taiwo Adeleke", email: "taiwo.adeleke@tradevu.com", jobTitle: "Product Manager", deptName: "Product" },
    { fullName: "Olumide Ojo", email: "olumide.ojo@tradevu.com", jobTitle: "Sales Executive", deptName: "Sales" },
    { fullName: "Bisi Alabi", email: "bisi.alabi@tradevu.com", jobTitle: "Marketing Specialist", deptName: "Marketing" }
  ];

  for (const emp of nigerianEmployees) {
    const dept = departments.find(d => d.name === emp.deptName) || departments[0];
    
    let existingEmp = await prisma.employee.findUnique({ where: { email: emp.email } });
    
    if (!existingEmp) {
      existingEmp = await prisma.employee.create({
        data: {
          organizationId: org.id,
          employeeCode: "EMP-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
          fullName: emp.fullName,
          email: emp.email,
          jobTitle: emp.jobTitle,
          departmentId: dept.id,
          hireDate: new Date(),
          employmentStatus: "ACTIVE",
          basicSalary: Math.floor(Math.random() * 500000) + 200000,
        }
      });
      console.log(`Created employee: ${emp.fullName}`);
      
      // Assign an onboarding template for some of them so they appear in tasks
      await prisma.onboardingTask.createMany({
        data: [
          {
            employeeId: existingEmp.id,
            title: "Provide Bank Details",
            description: "Submit Zenith Bank or GTBank details to HR",
            category: "documentation",
            status: "todo",
          },
          {
            employeeId: existingEmp.id,
            title: "IT Equipment Setup",
            description: "Receive MacBook and configure TradeVu VPN",
            category: "it_setup",
            status: "in_progress",
          }
        ]
      });
    } else {
      console.log(`Employee already exists: ${emp.fullName}`);
    }

    let user = await prisma.user.findUnique({ where: { email: emp.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: emp.email,
          passwordHash: "dummyhash",
          role: "EMPLOYEE",
          organizationId: org.id,
          employeeId: existingEmp.id
        }
      });
    } else if (!user.employeeId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { employeeId: existingEmp.id }
      });
    }
  }

  console.log("Done seeding Nigerian employees.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
