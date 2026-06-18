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

export const approvalsResolvers = {
  Query: {
promotionRequests: async (_, {
  employeeId
}, {
  user,
  prisma,
  requireAuth
}) => {
  requireAuth();
  const where = employeeId ? {
    employeeId,
    employee: {
      organizationId: user.organizationId
    }
  } : {
    employee: {
      organizationId: user.organizationId
    }
  };
  return prisma.promotionRequest.findMany({
    where,
    include: {
      employee: true,
      requestedBy: true,
      approvals: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
},
previewPromotionBenefits: async (_, {
  employeeId,
  newGrade
}, {
  user,
  prisma
}) => {
  if (!user) throw new Error("Not authenticated");
  const emp = await prisma.employee.findUnique({
    where: {
      id: employeeId
    }
  });
  if (!emp) throw new Error("Employee not found");
  const {
    hmoPlan,
    annualLeaveDays,
    newBasicSalary
  } = await calculateBenefits(emp, newGrade, prisma);
  let oldLeaveDays = 0;
  const annualLeaveType = await prisma.leaveType.findFirst({
    where: {
      organizationId: emp.organizationId,
      name: {
        contains: 'Annual',
        mode: 'insensitive'
      }
    }
  });
  if (annualLeaveType) {
    const existingBalance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: annualLeaveType.id,
          year: new Date().getFullYear()
        }
      }
    });
    if (existingBalance) oldLeaveDays = existingBalance.totalEntitled;
  }
  return {
    oldSalary: emp.basicSalary || 0,
    newSalary: newBasicSalary,
    oldLeaveDays,
    newLeaveDays: annualLeaveDays,
    oldHmoPlan: emp.hmoPlan || 'None',
    newHmoPlan: hmoPlan
  };
},
profileUpdateRequests: async (_, __, {
  prisma,
  user,
  requireRole
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  // Should filter by organizationId, but profileUpdateRequest only has employeeId
  // We will fetch where employee.organizationId == user.organizationId
  return prisma.profileUpdateRequest.findMany({
    where: {
      employee: {
        organizationId: user.organizationId
      }
    },
    include: {
      employee: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}
  },
};
