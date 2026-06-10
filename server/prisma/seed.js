import { prisma } from '../src/db.js'
import bcrypt from 'bcryptjs'

async function main() {
  // Check if organization already exists
  let org = await prisma.organization.findFirst({
    where: { name: 'TradeVu' }
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'TradeVu',
        ownerEmail: 'superadmin@tradevu.com',
      }
    });
  }

  // Hash passwords
  const superAdminPassword = await bcrypt.hash('Admin@12345', 10)
  const hrAdminPassword = await bcrypt.hash('HrAdmin@12345', 10)
  const employeePassword = await bcrypt.hash('Employee@12345', 10)

  // Seed Departments
  const departments = ['Engineering', 'Product', 'Sales', 'Marketing', 'Human Resources'];
  for (const dept of departments) {
    const existingDept = await prisma.department.findFirst({
      where: { name: dept, organizationId: org.id }
    });
    if (!existingDept) {
      await prisma.department.create({
        data: {
          name: dept,
          code: dept.toUpperCase().substring(0, 3),
          organizationId: org.id,
        }
      });
    }
  }

  // Seed Employees First
  const superAdminEmployee = await prisma.employee.upsert({
    where: { email: 'superadmin@tradevu.com' },
    update: {},
    create: {
      employeeCode: 'EMP-0001',
      organizationId: org.id,
      fullName: 'Super Admin',
      email: 'superadmin@tradevu.com',
      hireDate: new Date(),
      jobTitle: 'Super Administrator',
      employmentStatus: 'ACTIVE',
    }
  });

  const hrAdminEmployee = await prisma.employee.upsert({
    where: { email: 'hradmin@tradevu.com' },
    update: {},
    create: {
      employeeCode: 'EMP-0002',
      organizationId: org.id,
      fullName: 'HR Administrator',
      email: 'hradmin@tradevu.com',
      hireDate: new Date(),
      jobTitle: 'HR Administrator',
      employmentStatus: 'ACTIVE',
    }
  });

  const standardEmployee = await prisma.employee.upsert({
    where: { email: 'employee@tradevu.com' },
    update: {},
    create: {
      employeeCode: 'EMP-0003',
      organizationId: org.id,
      fullName: 'Jane Employee',
      email: 'employee@tradevu.com',
      hireDate: new Date(),
      jobTitle: 'Software Engineer',
      employmentStatus: 'ACTIVE',
    }
  });

  // Super Admin
  await prisma.user.upsert({
    where: { email: 'superadmin@tradevu.com' },
    update: { passwordHash: superAdminPassword, employeeId: superAdminEmployee.id },
    create: {
      email: 'superadmin@tradevu.com',
      passwordHash: superAdminPassword,
      role: 'SUPER_ADMIN',
      organizationId: org.id,
      isOrgOwner: true,
      employeeId: superAdminEmployee.id
    }
  })

  // HR Admin
  await prisma.user.upsert({
    where: { email: 'hradmin@tradevu.com' },
    update: { passwordHash: hrAdminPassword, employeeId: hrAdminEmployee.id },
    create: {
      email: 'hradmin@tradevu.com',
      passwordHash: hrAdminPassword,
      role: 'HR_ADMIN',
      organizationId: org.id,
      employeeId: hrAdminEmployee.id
    }
  })

  // Employee
  await prisma.user.upsert({
    where: { email: 'employee@tradevu.com' },
    update: { passwordHash: employeePassword, employeeId: standardEmployee.id },
    create: {
      email: 'employee@tradevu.com',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      organizationId: org.id,
      employeeId: standardEmployee.id
    }
  })

  // Seed Approval Workflows
  const workflowsToSeed = [
    {
      name: 'Leave Request Workflow',
      entityType: 'LeaveRequest',
      steps: [
        { order: 1, role: 'MANAGER' },
        { order: 2, role: 'HR_ADMIN' }
      ]
    },
    {
      name: 'Payroll Processing Workflow',
      entityType: 'PayrollRun',
      steps: [
        { order: 1, role: 'HR_ADMIN' },
        { order: 2, role: 'FINANCE' }
      ]
    },
    {
      name: 'Document Publishing Workflow',
      entityType: 'Document',
      steps: [
        { order: 1, role: 'HR_ADMIN' },
        { order: 2, role: 'SUPER_ADMIN' }
      ]
    },
    {
      name: 'Employee Profile Updates',
      entityType: 'Employee',
      steps: [
        { order: 1, role: 'HR_ADMIN' }
      ]
    }
  ];

  for (const wf of workflowsToSeed) {
    const existingWf = await prisma.approvalWorkflow.findFirst({
      where: { name: wf.name, organizationId: org.id }
    });
    if (!existingWf) {
      await prisma.approvalWorkflow.create({
        data: {
          name: wf.name,
          entityType: wf.entityType,
          steps: wf.steps,
          organizationId: org.id,
          isActive: true
        }
      });
    }
  }

  
  // Seed Leave Types
  const leaveTypes = [
    { name: 'Annual Leave', daysPerYear: 15, isPaid: true, requiresApproval: true, canCarryForward: false, noticeDaysRequired: 10 },
    { name: 'Sick Leave', daysPerYear: 10, isPaid: true, requiresApproval: true, canCarryForward: false, noticeDaysRequired: 0, requiresProof: true },
    { name: 'Maternity Leave', daysPerYear: 105, isPaid: true, requiresApproval: true, canCarryForward: false, noticeDaysRequired: 70 }, // 15 weeks, 10 weeks notice
    { name: 'Paternity Leave', daysPerYear: 14, isPaid: true, requiresApproval: true, canCarryForward: false, noticeDaysRequired: 30 }, // 1 month notice
    { name: 'Casual Leave', daysPerYear: 5, isPaid: true, requiresApproval: true, canCarryForward: false, noticeDaysRequired: 0 },
    { name: 'Bereavement Leave', daysPerYear: 14, isPaid: true, requiresApproval: true, canCarryForward: false, noticeDaysRequired: 0 },
    { name: 'Study Leave', daysPerYear: 5, isPaid: true, requiresApproval: true, canCarryForward: false, noticeDaysRequired: 14, requiresProof: true },
    { name: 'Leave of Absence', daysPerYear: 0, isPaid: false, requiresApproval: true, canCarryForward: false, noticeDaysRequired: 30 }
  ];

  for (const lt of leaveTypes) {
    const existingLt = await prisma.leaveType.findFirst({
      where: { name: lt.name, organizationId: org.id }
    });
    if (!existingLt) {
      await prisma.leaveType.create({
        data: {
          ...lt,
          organizationId: org.id
        }
      });
    } else {
      await prisma.leaveType.update({
        where: { id: existingLt.id },
        data: { ...lt }
      });
    }
  }

  console.log('Seeded database with test users, employees, and workflows')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
