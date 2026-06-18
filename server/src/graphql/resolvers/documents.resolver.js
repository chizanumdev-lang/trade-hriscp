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

export const documentsResolvers = {
  Query: {
documents: async (_, {
  employeeId,
  category
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  const where = {};
  if (category) where.category = category;
  if (['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    if (employeeId) where.employeeId = employeeId;
    where.status = {
      in: ['ACTIVE', 'PENDING', 'ARCHIVED']
    };
    return prisma.document.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
  if (user.role === 'EMPLOYEE') {
    if (employeeId && employeeId !== user.employeeId) {
      throw new Error("Cannot view documents for other employees");
    }
    where.employeeId = user.employeeId;
    where.status = {
      in: ['ACTIVE', 'PENDING']
    };
    where.visibilityLevel = {
      in: ['employee', 'all', 'EMPLOYEE', 'ALL']
    };
    return prisma.document.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
  if (user.role === 'MANAGER') {
    if (!employeeId) {
      const reports = await prisma.employee.findMany({
        where: {
          managerId: user.employeeId
        },
        select: {
          id: true
        }
      });
      where.employeeId = {
        in: reports.map(r => r.id)
      };
    } else {
      const emp = await prisma.employee.findUnique({
        where: {
          id: employeeId
        }
      });
      if (emp && emp.managerId !== user.employeeId && employeeId !== user.employeeId) {
        throw new Error("Not authorized to view this employee's documents");
      }
      where.employeeId = employeeId;
    }
    where.status = 'ACTIVE';
    if (employeeId === user.employeeId) {
      where.visibilityLevel = {
        in: ['employee', 'all']
      };
    } else {
      where.visibilityLevel = {
        in: ['manager', 'all']
      };
    }
    return prisma.document.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
  return [];
},
documentHistory: async (_, {
  documentId
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  return prisma.documentVersion.findMany({
    where: {
      documentId
    },
    orderBy: {
      version: 'desc'
    }
  });
},
getCloudinarySignature: async (_, __, {
  user,
  requireAuth
}) => {
  requireAuth();
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request({
    timestamp
  }, process.env.CLOUDINARY_API_SECRET);
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME
  };
}
  },
  Mutation: {
archiveDocument: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const document = await prisma.document.update({
    where: {
      id
    },
    data: {
      status: 'ARCHIVED'
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    actorId: user.id,
    entityType: 'Document',
    entityId: id,
    action: 'UPDATE',
    previousValue: existing,
    newValue: updatedEmp,
    ipAddress
  });
  return document;
}
  },
};
