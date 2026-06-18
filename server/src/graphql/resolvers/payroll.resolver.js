import { hashPassword, comparePassword, generateToken } from '../../utils/auth.js';

import { v2 as cloudinary } from 'cloudinary';

import { createAuditLog, recordApprovalEvent } from '../../utils/audit.js';

import { NotificationService } from '../../services/NotificationService.js';

import { client as triggerClient } from '../../jobs/trigger.js';

import { applyDynamicBenefits, calculateBenefits } from '../../utils/benefitsMatrix.js';

const checkAndPromoteEmployee = async (employeeId, prisma) => {
  const emp = await prisma.employee.findUnique({
    where: {
      id: employeeId
    },
    include: {
      department: true
    }
  });
  if (!emp || emp.employmentStatus !== 'DRAFT') return;

  // Auto-assign manager if missing
  let currentManagerId = emp.managerId;
  if (!currentManagerId) {
    if (emp.department?.headEmployeeId) {
      currentManagerId = emp.department.headEmployeeId;
    } else {
      const hrAdmin = await prisma.user.findFirst({
        where: {
          organizationId: emp.organizationId,
          role: 'HR_ADMIN',
          employeeId: {
            not: null
          }
        }
      });
      if (hrAdmin) {
        currentManagerId = hrAdmin.employeeId;
      }
    }
    if (currentManagerId) {
      await prisma.employee.update({
        where: {
          id: employeeId
        },
        data: {
          managerId: currentManagerId
        }
      });
    }
  }
  const isComplete = emp.phone && emp.privateEmail && emp.dateOfBirth && emp.gender && emp.maritalStatus && emp.nationality && emp.nationalId && emp.passportNumber && currentManagerId;
  if (isComplete) {
    const docCount = await prisma.document.count({
      where: {
        employeeId
      }
    });
    if (docCount > 0) {
      await prisma.employee.update({
        where: {
          id: employeeId
        },
        data: {
          employmentStatus: 'PENDING_APPROVAL'
        }
      });

      // Notify the manager or HR about the pending approval
      if (currentManagerId) {
        const managerUser = await prisma.user.findFirst({
          where: {
            employeeId: currentManagerId
          }
        });
        if (managerUser) {
          await NotificationService.notify({
            prisma,
            userId: managerUser.id,
            organizationId: emp.organizationId,
            title: 'Employee Approval Required',
            message: `${emp.firstName} ${emp.lastName} has completed their profile and is waiting for approval.`,
            type: 'APPROVAL',
            link: `/employees/${emp.id}`
          });
        }
      }
    }
  }
};

export const payrollResolvers = {
  Query: {
salaryHistory: async (_, {
  employeeId
}, {
  prisma,
  requireAuth
}) => {
  requireAuth();
  return prisma.salaryHistory.findMany({
    where: {
      employeeId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
},
// Phase 3 Queries
payrollRuns: async (_, __, {
  prisma,
  user,
  requireRole
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
  return prisma.payrollRun.findMany({
    where: {
      organizationId: user.organizationId
    },
    orderBy: {
      month: 'desc'
    }
  });
},
payrollRecords: async (_, {
  payrollRunId
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
  // Should filter by organizationId, but payrollRecord only has employeeId.
  // We will fetch where employee.organizationId == user.organizationId
  return prisma.payrollRecord.findMany({
    where: {
      payrollRunId,
      employee: {
        organizationId: user.organizationId
      }
    }
  });
},
myPayrollRecords: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  if (!user.employeeId) return [];
  return prisma.payrollRecord.findMany({
    where: {
      employeeId: user.employeeId
    }
  });
}
  },
  Mutation: {
createPayrollRun: async (_, {
  month,
  periodStart,
  periodEnd
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
  const employees = await prisma.employee.findMany({
    where: {
      organizationId: user.organizationId,
      employmentStatus: 'ACTIVE'
    }
  });
  let totalGross = 0;
  let totalNet = 0;
  const payrollRun = await prisma.payrollRun.create({
    data: {
      month,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      organizationId: user.organizationId,
      status: 'DRAFT',
      totalGross: 0,
      totalNet: 0
    }
  });
  const records = employees.map(emp => {
    const basicSalary = emp.basicSalary || 0;

    // Sum Allowances
    let totalAllowances = 0;
    const employeeAllowances = emp.allowances || {};
    Object.values(employeeAllowances).forEach(val => {
      totalAllowances += parseFloat(val) || 0;
    });
    const grossPay = basicSalary + totalAllowances;

    // Nigerian PAYE Calculation
    // 1. Annualize
    const annualGross = grossPay * 12;

    // 2. Compute Pension (8% of gross)
    const annualPension = annualGross * 0.08;

    // 3. Consolidated Relief Allowance (CRA)
    const cra = Math.max(200000, annualGross * 0.01) + annualGross * 0.20;

    // 4. Taxable Income
    let taxableIncome = annualGross - annualPension - cra;
    if (taxableIncome < 0) taxableIncome = 0;

    // 5. Apply Tax Brackets
    let annualTax = 0;
    if (taxableIncome > 0) {
      const b1 = Math.min(taxableIncome, 300000);
      annualTax += b1 * 0.07;
      taxableIncome -= b1;
    }
    if (taxableIncome > 0) {
      const b2 = Math.min(taxableIncome, 300000);
      annualTax += b2 * 0.11;
      taxableIncome -= b2;
    }
    if (taxableIncome > 0) {
      const b3 = Math.min(taxableIncome, 500000);
      annualTax += b3 * 0.15;
      taxableIncome -= b3;
    }
    if (taxableIncome > 0) {
      const b4 = Math.min(taxableIncome, 500000);
      annualTax += b4 * 0.19;
      taxableIncome -= b4;
    }
    if (taxableIncome > 0) {
      const b5 = Math.min(taxableIncome, 1600000);
      annualTax += b5 * 0.21;
      taxableIncome -= b5;
    }
    if (taxableIncome > 0) {
      annualTax += taxableIncome * 0.24;
    }

    // Convert to monthly
    const monthlyTax = annualTax / 12;
    const monthlyPension = annualPension / 12;
    const totalDeductions = monthlyTax + monthlyPension;
    const netPay = grossPay - totalDeductions;
    totalGross += grossPay;
    totalNet += netPay;
    return {
      payrollRunId: payrollRun.id,
      employeeId: emp.id,
      basicSalary,
      allowances: employeeAllowances,
      grossPay,
      deductions: {
        tax: monthlyTax,
        pension: monthlyPension
      },
      totalDeductions,
      netPay
    };
  });
  await prisma.payrollRecord.createMany({
    data: records
  });
  return prisma.payrollRun.update({
    where: {
      id: payrollRun.id
    },
    data: {
      totalGross,
      totalNet
    }
  });
},
approvePayrollRun: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'FINANCE_ADMIN']);
  const pr = await prisma.payrollRun.findUnique({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  const updated = await prisma.payrollRun.update({
    where: {
      id,
      organizationId: user.organizationId
    },
    data: {
      status: 'APPROVED',
      approvedBy: user.id
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    actorId: user.id,
    entityType: 'PayrollRun',
    entityId: id,
    action: 'APPROVED',
    previousValue: policy,
    newValue: updated,
    ipAddress
  });
  await recordApprovalEvent({
    entityType: 'PayrollRun',
    entityId: id,
    approverUserId: user.id,
    action: 'APPROVED',
    previousStatus: pr.status
  });
  return updated;
}
  },
};
