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

export const attendanceResolvers = {
  Query: {
attendanceRecords: async (_, {
  employeeId,
  date
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  const where = {
    employee: {
      organizationId: user.organizationId
    }
  };
  if (employeeId) where.employeeId = employeeId;
  if (date) where.date = new Date(date);
  return prisma.attendance.findMany({
    where,
    orderBy: {
      date: 'desc'
    }
  });
}
  },
  Mutation: {
clockIn: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  if (!user.employeeId) throw new Error("User is not an employee");
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  return prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: user.employeeId,
        date: today
      }
    },
    update: {
      clockIn: new Date()
    },
    create: {
      employeeId: user.employeeId,
      date: today,
      clockIn: new Date()
    }
  });
},
clockOut: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  if (!user.employeeId) throw new Error("User is not an employee");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.attendance.update({
    where: {
      employeeId_date: {
        employeeId: user.employeeId,
        date: today
      }
    },
    data: {
      clockOut: new Date()
    }
  });
}
  },
};
