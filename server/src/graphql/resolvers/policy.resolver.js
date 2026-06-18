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

export const policyResolvers = {
  Query: {
// Phase 4 Queries
policies: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  return prisma.policy.findMany({
    where: {
      organizationId: user.organizationId
    }
  });
},
announcements: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  return prisma.announcement.findMany({
    where: {
      organizationId: user.organizationId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}
  },
  Mutation: {
// Phase 4 Mutations
createPolicy: async (_, {
  title,
  category,
  content,
  requiresAck
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  return prisma.policy.create({
    data: {
      title,
      category,
      content,
      requiresAck,
      organizationId: user.organizationId,
      createdBy: user.id,
      status: 'DRAFT'
    }
  });
},
createAnnouncement: async (_, {
  title,
  content,
  priority
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  return prisma.announcement.create({
    data: {
      title,
      content,
      priority,
      organizationId: user.organizationId,
      createdBy: user.id
    }
  });
}
  },
};
