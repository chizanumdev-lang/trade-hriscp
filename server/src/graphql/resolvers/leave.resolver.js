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

export const leaveResolvers = {
  Query: {
// Phase 2 Queries
leaveTypes: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  return prisma.leaveType.findMany({
    where: {
      organizationId: user.organizationId
    }
  });
},
leaveRequests: async (_, {
  employeeId
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
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
  return prisma.leaveRequest.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    }
  });
},
paginatedLeaveRequests: async (_, {
  page = 1,
  limit = 10,
  employeeId
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const skip = (page - 1) * limit;
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
  const [leaveRequests, totalCount] = await Promise.all([prisma.leaveRequest.findMany({
    where,
    skip,
    take: limit,
    orderBy: {
      createdAt: 'desc'
    }
  }), prisma.leaveRequest.count({
    where
  })]);
  return {
    leaveRequests,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
},
myLeavePlans: async (_, {
  year
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const employee = await prisma.employee.findUnique({
    where: {
      email: user.email
    }
  });
  if (!employee) throw new Error("Employee record not found for this user");
  return prisma.leavePlan.findMany({
    where: {
      employeeId: employee.id,
      year
    },
    include: {
      employee: true
    }
  });
},
teamLeavePlans: async (_, {
  year
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  if (['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return prisma.leavePlan.findMany({
      where: {
        year
      },
      include: {
        employee: true
      }
    });
  }
  const employee = await prisma.employee.findUnique({
    where: {
      email: user.email
    }
  });
  if (!employee) return [];
  return prisma.leavePlan.findMany({
    where: {
      year,
      employee: {
        managerId: employee.id
      }
    },
    include: {
      employee: true
    }
  });
}
  },
  Mutation: {
// Phase 2 Mutations
createLeaveType: async (_, {
  name,
  daysPerYear,
  isPaid = true,
  requiresApproval = true
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  return prisma.leaveType.create({
    data: {
      name,
      daysPerYear,
      isPaid,
      requiresApproval,
      organizationId: user.organizationId
    }
  });
},
approveLeaveRequest: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  const leave = await prisma.leaveRequest.findUnique({
    where: {
      id
    },
    include: {
      employee: {
        include: {
          user: true
        }
      }
    }
  });
  let nextStatus = 'APPROVED';
  if (user.role === 'MANAGER' && leave.status === 'PENDING') {
    nextStatus = 'PENDING_HR';
  }
  const updated = await prisma.leaveRequest.update({
    where: {
      id
    },
    data: {
      status: nextStatus
    }
  });
  await recordApprovalEvent({
    entityType: 'LeaveRequest',
    entityId: id,
    approverUserId: user.id,
    action: nextStatus,
    previousStatus: leave.status
  });
  if (leave.employee?.user?.id) {
    await NotificationService.notify({
      userId: leave.employee.user.id,
      category: 'leave',
      title: `Leave Request Update`,
      message: `Your leave request status is now ${nextStatus.replace('_', ' ')}.`,
      deepLink: '/LeaveManagement',
      sendEmail: true
    });
  }
  return updated;
},
rejectLeaveRequest: async (_, {
  id,
  reason
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  const leave = await prisma.leaveRequest.findUnique({
    where: {
      id
    }
  });
  const updated = await prisma.leaveRequest.update({
    where: {
      id
    },
    data: {
      status: 'REJECTED'
    }
  });
  await recordApprovalEvent({
    entityType: 'LeaveRequest',
    entityId: id,
    approverUserId: user.id,
    action: 'REJECTED',
    comments: reason,
    previousStatus: leave.status
  });
  return updated;
},
submitLeavePlan: async (_, {
  year,
  plannedDates
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const employee = await prisma.employee.findUnique({
    where: {
      email: user.email
    }
  });
  if (!employee) throw new Error("Employee not found");
  return prisma.leavePlan.upsert({
    where: {
      employeeId_year: {
        employeeId: employee.id,
        year
      }
    },
    update: {
      plannedDates,
      status: 'PENDING'
    },
    create: {
      employeeId: employee.id,
      year,
      plannedDates,
      status: 'PENDING'
    }
  });
},
approveLeavePlan: async (_, {
  planId
}, {
  prisma,
  requireRole
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  return prisma.leavePlan.update({
    where: {
      id: planId
    },
    data: {
      status: 'APPROVED'
    }
  });
},
rejectLeavePlan: async (_, {
  planId
}, {
  prisma,
  requireRole
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  return prisma.leavePlan.update({
    where: {
      id: planId
    },
    data: {
      status: 'REJECTED'
    }
  });
}
  },
};
