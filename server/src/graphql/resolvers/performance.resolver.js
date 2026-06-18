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

export const performanceResolvers = {
  Query: {
goals: async (_, {
  employeeId
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  return prisma.goal.findMany({
    where: {
      employeeId,
      employee: {
        organizationId: user.organizationId
      }
    }
  });
},
// Phase 5 & 6 Queries
checkIns: async (_, {
  employeeId
}, {
  prisma,
  requireAuth
}) => {
  requireAuth();
  return prisma.checkIn.findMany({
    where: {
      employeeId
    },
    orderBy: {
      period: 'desc'
    }
  });
}
  },
  Mutation: {
createGoal: async (_, {
  employeeId,
  title,
  weight,
  period
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  return prisma.goal.create({
    data: {
      employeeId,
      title,
      weight,
      period
    }
  });
},
// Phase 5 & 6 Mutations
createCheckIn: async (_, {
  employeeId,
  period,
  scheduledDate
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  return prisma.checkIn.create({
    data: {
      employeeId,
      managerId: user.employeeId,
      period,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null
    }
  });
},
updateCheckIn: async (_, {
  id,
  selfAppraisal,
  managerNotes,
  overallRating,
  status
}, {
  prisma,
  requireAuth
}) => {
  requireAuth();
  const data = {};
  if (selfAppraisal !== undefined) data.selfAppraisal = selfAppraisal;
  if (managerNotes !== undefined) data.managerNotes = managerNotes;
  if (overallRating !== undefined) data.overallRating = overallRating;
  if (status !== undefined) {
    data.status = status;
    if (status === 'completed') data.completedDate = new Date();
  }
  return prisma.checkIn.update({
    where: {
      id
    },
    data
  });
}
  },
};
