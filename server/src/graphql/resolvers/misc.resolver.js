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
            userId: managerUser.id,
            category: 'approval',
            title: 'Employee Approval Required',
            message: `${emp.firstName} ${emp.lastName} has completed their profile and is waiting for approval.`,
            deepLink: `/employees/${emp.id}`
          });
        }
      }
    }
  }
};

export const miscResolvers = {
  Query: {
loans: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const where = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) ? {} : {
    employeeId: user.employeeId
  };
  const loans = await prisma.loan.findMany({
    where,
    include: {
      employee: true
    }
  });
  return loans.map(l => ({
    ...l,
    employee_id: l.employeeId,
    employee_name: l.employee?.fullName,
    loan_type: 'standard',
    // For backward compat with UI
    loan_amount: l.amount,
    duration_months: Math.ceil(l.amount / l.monthlyRepayment),
    monthly_installment: l.monthlyRepayment,
    start_month: l.startDate.toISOString().slice(0, 7)
  }));
},
paginatedLoans: async (_, {
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
  const where = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) ? {} : {
    employeeId: user.employeeId
  };
  if (employeeId && ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
    where.employeeId = employeeId;
  }
  const [loansData, totalCount] = await Promise.all([prisma.loan.findMany({
    where,
    skip,
    take: limit,
    include: {
      employee: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  }), prisma.loan.count({
    where
  })]);
  const mappedLoans = loansData.map(l => ({
    ...l,
    employee_id: l.employeeId,
    employee_name: l.employee?.fullName,
    loan_type: 'standard',
    // For backward compat with UI
    loan_amount: l.amount,
    duration_months: Math.ceil(l.amount / l.monthlyRepayment),
    monthly_installment: l.monthlyRepayment,
    start_month: l.startDate.toISOString().slice(0, 7)
  }));
  return {
    loans: mappedLoans,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
},
paginatedEmployees: async (_, {
  page = 1,
  limit = 10,
  search = "",
  status = "all",
  employmentStatus = "all"
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const skip = (page - 1) * limit;
  const where = {
    organizationId: user.organizationId
  };
  if (employmentStatus && employmentStatus !== "all") {
    where.employmentStatus = employmentStatus.toUpperCase();
  } else {
    where.employmentStatus = {
      notIn: ['RESIGNED', 'TERMINATED', 'OFFBOARDED']
    };
  }
  if (search) {
    where.OR = [{
      fullName: {
        contains: search,
        mode: 'insensitive'
      }
    }, {
      email: {
        contains: search,
        mode: 'insensitive'
      }
    }, {
      jobTitle: {
        contains: search,
        mode: 'insensitive'
      }
    }];
  }
  if (status && status !== "all") {
    if (status === "not_started") {
      where.OR = where.OR ? [...where.OR] : []; // simplified approach, let's just add to where
      where.onboardingStatus = {
        in: ['not_started', null, '']
      }; // Need to handle nulls mapping to not_started
    } else {
      where.onboardingStatus = status;
    }
  }
  const [emps, totalCount] = await Promise.all([prisma.employee.findMany({
    where,
    skip,
    take: limit,
    orderBy: {
      createdAt: 'desc'
    }
  }), prisma.employee.count({
    where
  })]);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    employees: emps.map(emp => ({
      ...emp,
      hireDate: emp.hireDate ? emp.hireDate.toISOString() : null
    })),
    totalCount,
    totalPages: totalPages === 0 ? 1 : totalPages,
    currentPage: page
  };
},
departments: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  return prisma.department.findMany({
    where: {
      organizationId: user.organizationId
    },
    include: {
      employees: true
    }
  });
},
department: async (_, {
  id
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  return prisma.department.findFirst({
    where: {
      id,
      organizationId: user.organizationId
    },
    include: {
      employees: true
    }
  });
},
onboardingTasks: async (_, { employeeId }, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);
  
  const where = {
    employee: { organizationId: user.organizationId }
  };

  if (!isAdmin) {
    where.OR = [
      { employeeId: user.employeeId },
      { assignedTo: user.email },
      { assignedTo: user.id }
    ];
  }

  if (employeeId) {
    where.employeeId = employeeId;
  }
  
  return prisma.onboardingTask.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
},
shifts: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  return prisma.shift.findMany({
    where: {
      organizationId: user.organizationId
    }
  });
},
approvalWorkflows: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const workflows = await prisma.approvalWorkflow.findMany({
    where: {
      organizationId: user.organizationId
    }
  });
  return workflows.map(wf => ({
    ...wf,
    steps: wf.steps ? JSON.stringify(wf.steps) : '[]'
  }));
},

offboardingDetails: async (_, {
  employeeId
}, {
  prisma,
  requireAuth
}) => {
  requireAuth();
  return prisma.offboarding.findUnique({
    where: {
      employeeId
    }
  });
},
allOffboardings: async (_, __, {
  prisma,
  requireAuth
}) => {
  requireAuth();
  return prisma.offboarding.findMany({
    include: {
      employee: true
    }
  });
},
upcomingCelebrations: async (_, {
  month
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  const employees = await prisma.employee.findMany({
    where: {
      organizationId: user.organizationId,
      employmentStatus: 'ACTIVE'
    },
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      hireDate: true
    }
  });
  const celebrations = [];
  employees.forEach(emp => {
    if (emp.dateOfBirth && emp.dateOfBirth.getMonth() + 1 === month) {
      celebrations.push({
        employeeId: emp.id,
        fullName: emp.fullName,
        type: 'BIRTHDAY',
        date: emp.dateOfBirth.toISOString(),
        years: null
      });
    }
    if (emp.hireDate && emp.hireDate.getMonth() + 1 === month) {
      const years = new Date().getFullYear() - emp.hireDate.getFullYear();
      if (years > 0) {
        celebrations.push({
          employeeId: emp.id,
          fullName: emp.fullName,
          type: 'WORK_ANNIVERSARY',
          date: emp.hireDate.toISOString(),
          years: years
        });
      }
    }
  });
  return celebrations;
}
  },
  Mutation: {
approveEmployeeData: async (_, {
  employeeId
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  try {
    const emp = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      organizationId: user.organizationId
    }
  });
  if (!emp) throw new Error("Employee not found");
  if (emp.employmentStatus !== 'PENDING_APPROVAL') {
    throw new Error("Employee is not in PENDING_APPROVAL state");
  }
  // Automatically approve pending documents during onboarding profile approval
  await prisma.document.updateMany({
    where: {
      employeeId: emp.id,
      status: 'PENDING'
    },
    data: {
      status: 'APPROVED'
    }
  });
  const updatedEmp = await prisma.employee.update({
    where: {
      id: employeeId
    },
    data: {
      employmentStatus: 'PENDING_ONBOARDING'
    }
  });

  await prisma.employeeStatusHistory.create({
    data: {
      employeeId: employeeId,
      previousStatus: emp.employmentStatus,
      newStatus: 'PENDING_ONBOARDING',
      changedBy: user.id,
      reason: 'Employee data approved'
    }
  });
  await createAuditLog({
    prisma,
    userId: user.id,
    organizationId: user.organizationId,
    action: 'APPROVE_EMPLOYEE_DATA',
    entityType: 'Employee',
    entityId: emp.id,
    details: {
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'PENDING_ONBOARDING'
    }
  });
    return updatedEmp;
  } catch (error) {
    console.error("Error in approveEmployeeData:", error);
    throw new Error(error.message || "Failed to approve employee data.");
  }
},
startOnboarding: async (_, {
  employeeId
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  const emp = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      organizationId: user.organizationId
    }
  });
  if (!emp) throw new Error("Employee not found");
  if (emp.employmentStatus !== 'PENDING_ONBOARDING') {
    throw new Error("Employee is not in PENDING_ONBOARDING state");
  }

  // Update employee status
  const updatedEmp = await prisma.employee.update({
    where: {
      id: employeeId
    },
    data: {
      onboardingStatus: 'in_progress',
      employmentStatus: 'ONGOING_ONBOARDING',
      onboardingProgress: 0
    }
  });

  await prisma.employeeStatusHistory.create({
    data: {
      employeeId: employeeId,
      previousStatus: emp.employmentStatus,
      newStatus: 'ONGOING_ONBOARDING',
      changedBy: user.id,
      reason: 'Onboarding started'
    }
  });

  // Generate onboarding tasks
  const tasks = [{
    title: 'IT setup',
    category: 'it_setup'
  }, {
    title: 'Laptop provision',
    category: 'it_setup'
  }, {
    title: 'Workspace setup',
    category: 'orientation'
  }, {
    title: 'System access',
    category: 'it_setup'
  }];
  for (const task of tasks) {
    await prisma.onboardingTask.create({
      data: {
        employeeId: emp.id,
        title: task.title,
        category: task.category,
        assignedTo: emp.fullName
      }
    });
  }
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'Employee',
    entityId: emp.id,
    action: 'START_ONBOARDING',
    ipAddress
  });

  // Notify the employee
  if (emp.user?.id) {
    await NotificationService.notify({
      userId: emp.user.id,
      category: 'onboarding',
      title: 'Onboarding Started',
      message: 'Welcome! Your onboarding process has started. Please check your pending tasks.',
      deepLink: '/EmployeeSelfService',
      sendEmail: true
    });
  }
  return updatedEmp;
},
suspendEmployee: async (_, {
  id,
  input
}, { prisma, user, ipAddress }) => {
  if (!user) throw new Error('Not authenticated');
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw new Error('Not authorized');
  }
  try {
    return await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id }, include: { department: true, organization: true } });
    const suspension = await tx.suspension.create({
      data: {
        employeeId: id,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        reason: input.reason || 'Employee suspended',
        status: 'PENDING'
      }
    });

    await tx.approvalRecord.create({
      data: {
        entityType: 'Suspension',
        entityId: suspension.id,
        suspensionRequestId: suspension.id,
        approverUserId: user.id, // Initial requester
        action: 'PENDING'
      }
    });
      return employee;
    });

    createAuditLog({
      ipAddress,
      userId: user.id, organizationId: user.organizationId,
      entityType: 'Employee',
      entityId: id,
      action: 'SUSPENSION_REQUESTED',
      details: `Suspension requested from ${input.startDate} to ${input.endDate}`
    });

    return result;
  } catch (error) {
    console.error("Error in suspendEmployee:", error);
    throw new Error(error.message || "Failed to process suspension request.");
  }
},
approveSuspension: async (_, { id, comments }, { prisma, user, ipAddress }) => {
  if (!user) throw new Error('Not authenticated');
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw new Error('Not authorized');
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const suspension = await tx.suspension.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: user.id }
    });

    const employee = await tx.employee.update({
      where: { id: suspension.employeeId },
      data: { employmentStatus: 'SUSPENDED' }
    });

    await tx.employeeStatusHistory.create({
      data: {
        employeeId: employee.id,
        previousStatus: 'ACTIVE',
        newStatus: 'SUSPENDED',
        changedBy: user.id,
        reason: suspension.reason || 'Employee suspended'
      }
    });

    await tx.approvalRecord.create({
      data: {
        entityType: 'Suspension',
        entityId: id,
        suspensionRequestId: id,
        approverUserId: user.id,
        action: 'APPROVED',
        comments
      }
    });

      return suspension;
    });

    createAuditLog({
      ipAddress,
      userId: user.id, organizationId: user.organizationId,
      entityType: 'Suspension', entityId: id,
      action: 'SUSPENSION_APPROVED',
      details: 'Suspension approved'
    });

    return result;
  } catch (error) {
    console.error("Error in approveSuspension:", error);
    throw new Error(error.message || "Failed to approve suspension.");
  }
},
rejectSuspension: async (_, { id, comments }, { prisma, user, ipAddress }) => {
  if (!user) throw new Error('Not authenticated');
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw new Error('Not authorized');
  }
  const result = await prisma.$transaction(async tx => {
    const suspension = await tx.suspension.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: user.id }
    });

    await tx.approvalRecord.create({
      data: {
        entityType: 'Suspension',
        entityId: id,
        suspensionRequestId: id,
        approverUserId: user.id,
        action: 'REJECTED',
        comments
      }
    });

      return suspension;
    });

    createAuditLog({
      ipAddress,
      userId: user.id, organizationId: user.organizationId,
      entityType: 'Suspension', entityId: id,
      action: 'SUSPENSION_REJECTED',
      details: 'Suspension rejected'
    });

    return result;
},

offboardEmployee: async (_, {
  id,
  input
}, { prisma, user }) => {
  if (!user) throw new Error('Not authenticated');
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw new Error('Not authorized');
  }
  return await prisma.$transaction(async tx => {
    // Find existing to avoid unique constraint if re-offboarding (optional), but let's just create or update
    // We will use upsert for Offboarding to prevent unique constraint errors if the record somehow exists
    const offboarding = await tx.offboarding.upsert({
      where: {
        employeeId: id
      },
      create: {
        employeeId: id,
        exitType: input.exitType,
        exitDate: new Date(input.exitDate),
        reason: input.reason
      },
      update: {
        exitType: input.exitType,
        exitDate: new Date(input.exitDate),
        reason: input.reason
      }
    });
    const statusMap = {
      'RESIGNATION': 'RESIGNED',
      'TERMINATION': 'TERMINATED',
      'RETIREMENT': 'OFFBOARDED',
      'CONTRACT_EXPIRATION': 'OFFBOARDED'
    };
    const employee = await tx.employee.update({
      where: {
        id
      },
      data: {
        employmentStatus: statusMap[input.exitType] || 'OFFBOARDED'
      },
      include: {
        department: true,
        organization: true
      }
    });

    await tx.employeeStatusHistory.create({
      data: {
        employeeId: id,
        previousStatus: employee.employmentStatus,
        newStatus: statusMap[input.exitType] || 'OFFBOARDED',
        changedBy: user.id,
        reason: input.reason || `Employee offboarded (${input.exitType})`
      }
    });
    await tx.auditLog.create({
      data: {
        organizationId: employee.organizationId,
        userId: user.id,
        action: 'OFFBOARD',
        entityType: 'EMPLOYEE',
        entityId: id,
        details: {
          type: input.exitType,
          exitDate: input.exitDate,
          reason: input.reason
        }
      }
    });
    return employee;
  });
},
updateOrganizationFeatures: async (_, {
  strictLeaveNotice
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  if (!user.organizationId) throw new Error("Not in an organization");
  if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) throw new Error("Not authorized");
  const org = await prisma.organization.findUnique({
    where: {
      id: user.organizationId
    }
  });
  const features = org.featuresEnabled || {};
  features.strictLeaveNotice = strictLeaveNotice;
  return await prisma.organization.update({
    where: {
      id: user.organizationId
    },
    data: {
      featuresEnabled: features
    }
  });
},
createLoan: async (_, {
  input
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const employeeId = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) ? input.employee_id : user.employeeId;
  if (!employeeId) throw new Error("Employee not found");
  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId
    }
  });
  if (!employee) throw new Error("Employee not found");

  // Validate Salary Advance
  if (input.loan_type === 'advance') {
    const basicSalary = employee.basicSalary || 0;
    if (input.loan_amount > basicSalary) {
      throw new Error("Salary advance cannot exceed one month's basic salary.");
    }
    if (input.duration_months > 1) {
      throw new Error("Salary advance must be paid back within 1 month.");
    }
  }
  const monthlyRepayment = input.loan_amount / input.duration_months;
  return await prisma.loan.create({
    data: {
      employeeId: employeeId,
      amount: input.loan_amount,
      monthlyRepayment: monthlyRepayment,
      remainingBalance: input.loan_amount,
      startDate: new Date()
    }
  });
},
upsertCompensationBand: async (_, {
  input
}, {
  user,
  prisma
}) => {
  if (!user || user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN') throw new Error("Not authorized");
  const {
    grade,
    minSalary,
    maxSalary,
    hmoPlan,
    annualLeaveDays
  } = input;
  return prisma.compensationBand.upsert({
    where: {
      organizationId_grade: {
        organizationId: user.organizationId,
        grade
      }
    },
    update: {
      minSalary,
      maxSalary,
      hmoPlan,
      annualLeaveDays
    },
    create: {
      organizationId: user.organizationId,
      grade,
      minSalary,
      maxSalary,
      hmoPlan,
      annualLeaveDays
    }
  });
},
requestPromotion: async (_, {
  input
}, {
  user,
  prisma
}) => {
  if (!user) throw new Error("Not authenticated");
  try {
    const {
    employeeId,
    effectiveDate,
    ...rest
  } = input;
  const eDateNum = Number(effectiveDate);
  const parsedEffectiveDate = isNaN(eDateNum) ? new Date(effectiveDate) : new Date(eDateNum);
  const isAutoApprove = user.role === 'SUPER_ADMIN';
  const req = await prisma.promotionRequest.create({
    data: {
      employeeId,
      requestedById: user.id,
      effectiveDate: parsedEffectiveDate,
      status: isAutoApprove ? 'APPROVED' : 'PENDING',
      isExecuted: false,
      ...rest
    }
  });
  await prisma.approvalRecord.create({
    data: {
      entityType: 'PromotionRequest',
      entityId: req.id,
      approverUserId: user.id,
      action: isAutoApprove ? 'APPROVED' : 'PENDING',
      promotionRequestId: req.id
    }
  });
  if (isAutoApprove && parsedEffectiveDate <= new Date()) {
    const currentEmployee = await prisma.employee.findUnique({
      where: {
        id: employeeId
      }
    });
    await prisma.employee.update({
      where: {
        id: employeeId
      },
      data: {
        jobTitle: req.newJobTitle || undefined,
        departmentId: req.newDepartmentId || undefined,
        employeeClass: req.newEmployeeClass || undefined,
        employeeGrade: req.newEmployeeGrade || undefined
      }
    });
    if (req.isHeadOfDepartment && req.newDepartmentId) {
      await prisma.department.update({
        where: {
          id: req.newDepartmentId
        },
        data: {
          headEmployeeId: employeeId
        }
      });
    }
    if (req.newEmployeeGrade) {
      await applyDynamicBenefits(employeeId, req.newEmployeeGrade, prisma);
    }
    await prisma.promotionHistory.create({
      data: {
        employeeId: employeeId,
        previousTitle: currentEmployee.jobTitle,
        newTitle: req.newJobTitle || currentEmployee.jobTitle,
        previousGrade: currentEmployee.employeeGrade,
        newGrade: req.newEmployeeGrade || currentEmployee.employeeGrade,
        effectiveDate: parsedEffectiveDate,
        approvedBy: user.id
      }
    });
    await prisma.promotionRequest.update({
      where: {
        id: req.id
      },
      data: {
        isExecuted: true
      }
    });
  }
  return req;
  } catch (error) {
    console.error("Error in requestPromotion:", error);
    throw new Error(error.message || "Failed to submit promotion request.");
  }
},
approvePromotion: async (_, {
  id,
  status,
  comments
}, {
  user,
  prisma
}) => {
  if (!user) throw new Error("Not authenticated");
  try {
    const req = await prisma.promotionRequest.update({
    where: {
      id
    },
    data: {
      status
    }
  });
  await prisma.approvalRecord.create({
    data: {
      entityType: 'PromotionRequest',
      entityId: id,
      approverUserId: user.id,
      action: status,
      comments,
      promotionRequestId: id
    }
  });

  // If approved and effectiveDate <= now, execute it immediately
  const parsedEffectiveDate = new Date(req.effectiveDate); // req.effectiveDate is already a Date object from DB
  if (status === 'APPROVED' && parsedEffectiveDate <= new Date()) {
    const currentEmployee = await prisma.employee.findUnique({
      where: {
        id: req.employeeId
      }
    });
    await prisma.employee.update({
      where: {
        id: req.employeeId
      },
      data: {
        jobTitle: req.newJobTitle || undefined,
        departmentId: req.newDepartmentId || undefined,
        employeeClass: req.newEmployeeClass || undefined,
        employeeGrade: req.newEmployeeGrade || undefined
      }
    });
    if (req.isHeadOfDepartment && req.newDepartmentId) {
      await prisma.department.update({
        where: {
          id: req.newDepartmentId
        },
        data: {
          headEmployeeId: req.employeeId
        }
      });
    }
    if (req.newEmployeeGrade) {
      await applyDynamicBenefits(req.employeeId, req.newEmployeeGrade, prisma);
    }
    await prisma.promotionHistory.create({
      data: {
        employeeId: req.employeeId,
        previousTitle: currentEmployee.jobTitle,
        newTitle: req.newJobTitle || currentEmployee.jobTitle,
        previousGrade: currentEmployee.employeeGrade,
        newGrade: req.newEmployeeGrade || currentEmployee.employeeGrade,
        effectiveDate: new Date(req.effectiveDate),
        approvedBy: user.id
      }
    });
    await prisma.promotionRequest.update({
      where: {
        id
      },
      data: {
        isExecuted: true
      }
    });
  }
  return req;
  } catch (error) {
    console.error("Error in approvePromotion:", error);
    throw new Error(error.message || "Failed to approve promotion.");
  }
},
updateEmployeeSelf: async (_, {
  input
}, {
  prisma,
  user,
  ipAddress
}) => {
  if (!user) throw new Error("Not authenticated");
  const existing = await prisma.employee.findFirst({
    where: {
      organizationId: user.organizationId,
      ...(user.employeeId ? {
        id: user.employeeId
      } : {
        email: user.email
      })
    }
  });
  if (!existing) throw new Error("Employee not found");
  const updateData = {};
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.privateEmail !== undefined) updateData.privateEmail = input.privateEmail;
  if (input.dateOfBirth !== undefined) {
    if (input.dateOfBirth) {
      const dNum = Number(input.dateOfBirth);
      updateData.dateOfBirth = isNaN(dNum) ? new Date(input.dateOfBirth) : new Date(dNum);
    } else {
      updateData.dateOfBirth = null;
    }
  }
  if (input.gender !== undefined) updateData.gender = input.gender;
  if (input.maritalStatus !== undefined) updateData.maritalStatus = input.maritalStatus;
  if (input.nationality !== undefined) updateData.nationality = input.nationality;
  if (input.nationalId !== undefined) updateData.nationalId = input.nationalId;
  if (input.passportNumber !== undefined) updateData.passportNumber = input.passportNumber;
  const updated = await prisma.employee.update({
    where: {
      id: existing.id
    },
    data: updateData
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'Employee',
    entityId: existing.id,
    action: 'UPDATE_SELF',
    previousValue: existing,
    newValue: updated
  });
  await checkAndPromoteEmployee(existing.id, prisma);
  return updated;
},
deleteEmployee: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const empToDelete = await prisma.employee.findUnique({
    where: {
      id
    }
  });
  await prisma.employee.delete({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'Employee',
    entityId: id,
    action: 'DELETE',
    previousValue: empToDelete
  });
  return true;
},
createDepartment: async (_, {
  name,
  code,
  headEmployeeId
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const isSuper = user.role === 'SUPER_ADMIN';
  const department = await prisma.department.create({
    data: {
      name,
      code,
      headEmployeeId,
      organizationId: user.organizationId,
      status: isSuper ? 'APPROVED' : 'PENDING'
    }
  });
  if (headEmployeeId && isSuper) {
    // Automatically handle manager role & assignments if created by Super Admin (approved immediately)
    const headUser = await prisma.user.findUnique({
      where: {
        employeeId: headEmployeeId
      }
    });
    if (headUser && headUser.role === 'EMPLOYEE') {
      await prisma.user.update({
        where: {
          id: headUser.id
        },
        data: {
          role: 'MANAGER'
        }
      });
    }
    await prisma.employee.updateMany({
      where: {
        departmentId: department.id
      },
      data: {
        managerId: headEmployeeId
      }
    });
  }
  return department;
},
updateDepartment: async (_, {
  id,
  name,
  code,
  headEmployeeId
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const department = await prisma.department.findUnique({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  if (!department) throw new Error("Department not found");
  const updated = await prisma.department.update({
    where: {
      id
    },
    data: {
      name,
      code,
      headEmployeeId
    }
  });
  if (headEmployeeId && department.status === 'APPROVED') {
    const headUser = await prisma.user.findUnique({
      where: {
        employeeId: headEmployeeId
      }
    });
    if (headUser && headUser.role === 'EMPLOYEE') {
      await prisma.user.update({
        where: {
          id: headUser.id
        },
        data: {
          role: 'MANAGER'
        }
      });
    }
    await prisma.employee.updateMany({
      where: {
        departmentId: department.id
      },
      data: {
        managerId: headEmployeeId
      }
    });
  }
  return updated;
},
approveDepartment: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN']);
  const department = await prisma.department.update({
    where: {
      id,
      organizationId: user.organizationId
    },
    data: {
      status: 'APPROVED'
    }
  });
  if (department.headEmployeeId) {
    const headUser = await prisma.user.findUnique({
      where: {
        employeeId: department.headEmployeeId
      }
    });
    if (headUser && headUser.role === 'EMPLOYEE') {
      await prisma.user.update({
        where: {
          id: headUser.id
        },
        data: {
          role: 'MANAGER'
        }
      });
    }
    await prisma.employee.updateMany({
      where: {
        departmentId: department.id
      },
      data: {
        managerId: department.headEmployeeId
      }
    });
  }
  return department;
},
deleteDepartment: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  await prisma.department.delete({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  return true;
},
createShift: async (_, {
  name,
  startTime,
  endTime,
  breakMinutes
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  return prisma.shift.create({
    data: {
      name,
      startTime,
      endTime,
      breakMinutes: breakMinutes || 60,
      organizationId: user.organizationId
    }
  });
},
updateShift: async (_, {
  id,
  name,
  startTime,
  endTime,
  breakMinutes,
  isActive
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const data = {};
  if (name !== undefined) data.name = name;
  if (startTime !== undefined) data.startTime = startTime;
  if (endTime !== undefined) data.endTime = endTime;
  if (breakMinutes !== undefined) data.breakMinutes = breakMinutes;
  if (isActive !== undefined) data.isActive = isActive;
  return prisma.shift.update({
    where: {
      id,
      organizationId: user.organizationId
    },
    data
  });
},
deleteShift: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  await prisma.shift.delete({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  return true;
},
createApprovalWorkflow: async (_, {
  name,
  entityType,
  steps
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  let parsedSteps;
  try {
    parsedSteps = JSON.parse(steps);
  } catch (e) {
    throw new Error("Invalid JSON in steps");
  }
  return prisma.approvalWorkflow.create({
    data: {
      name,
      entityType,
      steps: parsedSteps,
      organizationId: user.organizationId
    }
  });
},
updateApprovalWorkflow: async (_, {
  id,
  name,
  entityType,
  steps,
  isActive
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const data = {};
  if (name !== undefined) data.name = name;
  if (entityType !== undefined) data.entityType = entityType;
  if (isActive !== undefined) data.isActive = isActive;
  if (steps !== undefined) {
    try {
      data.steps = JSON.parse(steps);
    } catch (e) {
      throw new Error("Invalid JSON in steps");
    }
  }
  return prisma.approvalWorkflow.update({
    where: {
      id,
      organizationId: user.organizationId
    },
    data
  });
},
deleteApprovalWorkflow: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  await prisma.approvalWorkflow.delete({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  return true;
},
processApproval: async (_, {
  entityType,
  entityId,
  action,
  comments
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  // Only MANAGER, HR_ADMIN, or SUPER_ADMIN can process approvals
  if (['EMPLOYEE'].includes(user.role)) {
    throw new Error("Not authorized to process approvals");
  }
  let previousStatus = null;
  if (entityType === 'ProfileUpdateRequest') {
    const request = await prisma.profileUpdateRequest.findUnique({
      where: {
        id: entityId
      },
      include: {
        employee: true
      }
    });
    if (!request) throw new Error("Request not found");
    previousStatus = request.status;
    await prisma.profileUpdateRequest.update({
      where: {
        id: entityId
      },
      data: {
        status: action,
        reviewedBy: user.id
      }
    });

    // If approved, dynamically update the employee record
    if (action === 'APPROVED') {
      const updateData = {};
      updateData[request.fieldName] = request.requestedValue;
      await prisma.employee.update({
        where: {
          id: request.employeeId
        },
        data: updateData
      });
    }
  } else if (entityType === 'LeaveRequest') {
    const request = await prisma.leaveRequest.findUnique({
      where: {
        id: entityId
      },
      include: {
        employee: true
      }
    });
    if (!request) throw new Error("LeaveRequest not found");
    previousStatus = request.status;
    let newStatus = action;
    if (action === 'APPROVED') {
      if (user.role === 'SUPER_ADMIN') {
        newStatus = 'APPROVED';
      } else if (user.role === 'HR_ADMIN') {
        if (previousStatus === 'PENDING_SUPER_ADMIN') {
          throw new Error("Not authorized to approve this request (Requires Super Admin)");
        }
        newStatus = 'APPROVED';
      } else if (user.role === 'MANAGER') {
        if (previousStatus === 'PENDING_HR' || previousStatus === 'PENDING_SUPER_ADMIN') {
          throw new Error("Already approved by Manager, waiting for higher authority");
        }
        newStatus = 'PENDING_HR';
      }
    }
    await prisma.leaveRequest.update({
      where: {
        id: entityId
      },
      data: {
        status: newStatus
      }
    });
    if (newStatus === 'APPROVED' && previousStatus !== 'APPROVED') {
      const year = new Date(request.startDate).getFullYear();
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year
          }
        }
      });
      if (balance) {
        await prisma.leaveBalance.update({
          where: {
            id: balance.id
          },
          data: {
            used: balance.used + request.totalDays,
            available: balance.available - request.totalDays,
            pending: Math.max(0, balance.pending - request.totalDays)
          }
        });
      }
    }

    // Notify the employee about the leave action
    if (request.employee?.user?.id) {
      await NotificationService.notify({
        userId: request.employee.user.id,
        category: 'leave',
        title: `Leave Request ${newStatus}`,
        message: `Your leave request has been ${newStatus.toLowerCase().replace('_', ' ')}.`,
        deepLink: '/LeaveManagement',
        sendEmail: true
      });
    }
  } else if (entityType === 'PayrollRun') {
    if (!['FINANCE_ADMIN', 'HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new Error("Not authorized to approve Payroll");
    }
    const request = await prisma.payrollRun.findUnique({
      where: {
        id: entityId
      }
    });
    if (!request) throw new Error("PayrollRun not found");
    previousStatus = request.status;
    await prisma.payrollRun.update({
      where: {
        id: entityId
      },
      data: {
        status: action,
        approvedBy: user.id
      }
    });

    // Notify HR / Admin about payroll approval
    await NotificationService.notify({
      userId: request.processedBy || request.approvedBy || user.id,
      // Notify the original processor
      category: 'payroll',
      title: `Payroll Run ${action}`,
      message: `The payroll run for ${request.month} has been ${action.toLowerCase()}.`,
      deepLink: '/Payroll',
      sendEmail: true
    });
  } else if (entityType === 'Policy') {
    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new Error("Not authorized to approve Policy");
    }
    const request = await prisma.policy.findUnique({
      where: {
        id: entityId
      }
    });
    if (!request) throw new Error("Policy not found");
    previousStatus = request.status;
    await prisma.policy.update({
      where: {
        id: entityId
      },
      data: {
        status: action,
        approvedBy: user.id,
        publishedAt: action === 'APPROVED' ? new Date() : request.publishedAt
      }
    });
  } else if (entityType === 'SalaryHistory') {
    const request = await prisma.salaryHistory.findUnique({
      where: {
        id: entityId
      }
    });
    if (!request) throw new Error("Salary update request not found");
    previousStatus = request.status;
    await prisma.salaryHistory.update({
      where: {
        id: entityId
      },
      data: {
        status: action,
        approvedBy: user.id
      }
    });

    // If approved, dynamically update the employee record
    if (action === 'APPROVED') {
      await prisma.employee.update({
        where: {
          id: request.employeeId
        },
        data: {
          basicSalary: request.basicSalary,
          allowances: request.allowances
        }
      });
    }
  } else if (entityType === 'Goal') {
    const request = await prisma.goal.findUnique({
      where: {
        id: entityId
      },
      include: {
        employee: true
      }
    });
    if (!request) throw new Error("Goal not found");
    if (request.employee.managerId !== user.employeeId && user.role !== 'SUPER_ADMIN') {
      throw new Error("Only the direct manager can approve this goal");
    }
    previousStatus = request.status;
    await prisma.goal.update({
      where: {
        id: entityId
      },
      data: {
        status: action === 'APPROVED' ? 'approved' : 'draft',
        approvedBy: user.id
      }
    });
  } else if (entityType === 'Document') {
    if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new Error("Not authorized to approve Document");
    }
    const request = await prisma.document.findUnique({
      where: {
        id: entityId
      }
    });
    if (!request) throw new Error("Document not found");
    previousStatus = request.status;
    await prisma.document.update({
      where: {
        id: entityId
      },
      data: {
        status: action === 'APPROVED' ? 'ACTIVE' : 'DELETED'
      }
    });
  } else {
    throw new Error(`Approval for ${entityType} not implemented yet`);
  }
  const approvalRecord = await prisma.approvalRecord.create({
    data: {
      entityType,
      entityId,
      approverUserId: user.id,
      action,
      comments,
      previousStatus
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'ApprovalRecord',
    entityId: approvalRecord.id,
    action: 'CREATE'
  });
  return approvalRecord;
},
submitLeaveRequest: async (_, {
  input
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  if (!user.employeeId) throw new Error("User is not an employee");
  const employee = await prisma.employee.findUnique({
    where: {
      id: user.employeeId
    },
    include: {
      manager: {
        include: {
          user: true
        }
      },
      organization: true
    }
  });
  const leaveType = await prisma.leaveType.findUnique({
    where: {
      id: input.leaveTypeId
    }
  });
  if (!leaveType) throw new Error("Invalid leave type");

  // Validate attachment rules
  if (leaveType.name === 'Study Leave' && !input.attachmentUrl) {
    throw new Error("Study Leave requires an examination timetable or proof attachment.");
  }
  if (leaveType.name === 'Sick Leave' && input.totalDays > 2 && !input.attachmentUrl) {
    throw new Error("Sick Leave exceeding 2 days requires a medical certificate attachment.");
  }

  // Validate notice periods if strict toggle is on
  const strictNotice = employee.organization?.featuresEnabled?.strictLeaveNotice ?? true;
  if (strictNotice && leaveType.noticeDaysRequired > 0) {
    const noticeMs = leaveType.noticeDaysRequired * 24 * 60 * 60 * 1000;
    const requestedDate = new Date(input.startDate).getTime();
    const currentDate = new Date().getTime();
    if (requestedDate - currentDate < noticeMs) {
      throw new Error(`This leave type requires at least ${leaveType.noticeDaysRequired} days advance notice.`);
    }
  }
  const getInitialStatus = (role) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'APPROVED';
      case 'HR_ADMIN': return 'PENDING_SUPER_ADMIN';
      case 'MANAGER': return 'PENDING_HR';
      default: return 'PENDING';
    }
  };

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      employeeId: user.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      totalDays: input.isHalfDay ? 0.5 : input.selectedDates?.length > 0 ? input.selectedDates.length : input.totalDays,
      isHalfDay: input.isHalfDay || false,
      selectedDates: input.selectedDates || null,
      reason: input.reason,
      attachmentUrl: input.attachmentUrl,
      status: getInitialStatus(user.role)
    }
  });
  if (employee?.manager?.user?.id) {
    await NotificationService.notify({
      userId: employee.manager.user.id,
      category: 'leave',
      title: 'New Leave Request',
      message: `${employee.fullName} has submitted a new leave request pending your approval.`,
      deepLink: '/PendingApprovals',
      sendEmail: true
    });
  }
  return leaveRequest;
},
cancelLeaveRequest: async (_, {
  id
}, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const leave = await prisma.leaveRequest.findUnique({
    where: {
      id
    },
    include: {
      employee: true
    }
  });
  if (!leave) throw new Error("Leave request not found");

  // Allow employee to cancel their own, or an admin to cancel
  if (leave.employee.email !== user.email && !['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw new Error("Not authorized to cancel this leave request");
  }
  if (leave.status === 'CANCELLED') throw new Error("Already cancelled");
  const updated = await prisma.leaveRequest.update({
    where: {
      id
    },
    data: {
      status: 'CANCELLED'
    }
  });
  await recordApprovalEvent({
    entityType: 'LeaveRequest',
    entityId: id,
    approverUserId: user.id,
    action: 'CANCELLED',
    previousStatus: leave.status
  });
  return updated;
},
uploadDocument: async (_, args, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const {
    employeeId,
    name,
    category,
    fileUrl,
    fileType,
    fileSize,
    visibilityLevel
  } = args;
  let status = 'PENDING';
  if (user.role === 'SUPER_ADMIN') {
    status = 'ACTIVE';
  } else if (user.role === 'EMPLOYEE' && user.employeeId !== employeeId) {
    throw new Error("Employees can only upload their own documents");
  }
  const document = await prisma.document.create({
    data: {
      employeeId,
      name,
      category,
      fileUrl,
      fileType,
      fileSize,
      visibilityLevel,
      status,
      uploadedBy: user.id
    }
  });
  await createAuditLog({
    userId: user.id, organizationId: user.organizationId,
    entityType: 'Document',
    entityId: document.id,
    action: 'CREATE'
  });
  await checkAndPromoteEmployee(employeeId, prisma);
  return document;
},
replaceDocumentVersion: async (_, {
  id,
  fileUrl,
  fileType,
  fileSize
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  const document = await prisma.document.findUnique({
    where: {
      id
    }
  });
  if (!document) throw new Error("Document not found");
  if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
    // ok
  } else if (user.role === 'EMPLOYEE' && user.employeeId === document.employeeId) {
    // ok
  } else {
    throw new Error("Not authorized to replace this document");
  }
  await prisma.documentVersion.create({
    data: {
      documentId: id,
      version: document.currentVersion,
      fileUrl: document.fileUrl,
      fileType: document.fileType,
      fileSize: document.fileSize,
      uploadedBy: document.uploadedBy
    }
  });
  const newStatus = user.role === 'SUPER_ADMIN' ? 'ACTIVE' : 'PENDING';
  const updatedDocument = await prisma.document.update({
    where: {
      id
    },
    data: {
      fileUrl,
      fileType,
      fileSize,
      currentVersion: document.currentVersion + 1,
      status: newStatus,
      uploadedBy: user.id
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'Document',
    entityId: id,
    action: 'UPDATE',
    previousValue: existing,
    newValue: updatedEmp,
    ipAddress
  });
  triggerClient.sendEvent({
    name: 'document.uploaded',
    payload: {
      documentId: id,
      documentName: document.documentName,
      employeeId: document.employeeId
    }
  });
  return updatedDocument;
},
deleteDocument: async (_, {
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
      status: 'DELETED'
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'Document',
    entityId: id,
    action: 'DELETE',
    previousValue: empToDelete,
    ipAddress
  });
  return document;
},
approveDocument: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  const document = await prisma.document.findUnique({
    where: {
      id
    }
  });
  const updatedDocument = await prisma.document.update({
    where: {
      id
    },
    data: {
      status: 'ACTIVE'
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'Document',
    entityId: id,
    action: 'APPROVE'
  });
  await recordApprovalEvent({
    entityType: 'Document',
    entityId: id,
    approverUserId: user.id,
    action: 'APPROVED',
    previousStatus: document.status
  });
  // Notify the employee that their document was approved
  const docEmployee = await prisma.employee.findUnique({
    where: { id: document.employeeId },
    include: { user: true }
  });
  if (docEmployee?.user?.id) {
    await NotificationService.notify({
      userId: docEmployee.user.id,
      category: 'approval',
      title: 'Document Approved',
      message: `Your document "${document.name}" has been approved.`,
      deepLink: '/EmployeeSelfService'
    });
  }
  return updatedDocument;
},
rejectDocument: async (_, {
  id,
  reason
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  const document = await prisma.document.findUnique({
    where: {
      id
    }
  });
  const updatedDocument = await prisma.document.update({
    where: {
      id
    },
    data: {
      status: 'REJECTED'
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'Document',
    entityId: id,
    action: 'REJECT'
  });
  await recordApprovalEvent({
    entityType: 'Document',
    entityId: id,
    approverUserId: user.id,
    action: 'REJECTED',
    comments: reason,
    previousStatus: document.status
  });
  if (reason) {
    // Find the employee's user account to notify them correctly
    const docEmployee = await prisma.employee.findUnique({
      where: { id: document.employeeId },
      include: { user: true }
    });
    if (docEmployee?.user?.id) {
      await NotificationService.notify({
        userId: docEmployee.user.id,
        category: 'approval',
        title: 'Document Rejected',
        message: `Your document "${document.name}" was rejected. Reason: ${reason}`,
        deepLink: '/EmployeeSelfService'
      });
    }
  }
  return document;
},
approveProfileUpdateRequest: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  const request = await prisma.profileUpdateRequest.findUnique({
    where: {
      id
    }
  });
  const updatedRequest = await prisma.profileUpdateRequest.update({
    where: {
      id
    },
    data: {
      status: 'APPROVED',
      reviewedBy: user.id
    }
  });
  const updateData = {};
  updateData[request.fieldName] = request.requestedValue;
  await prisma.employee.update({
    where: {
      id: request.employeeId
    },
    data: updateData
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'ProfileUpdateRequest',
    entityId: id,
    action: 'APPROVE'
  });
  await recordApprovalEvent({
    entityType: 'ProfileUpdateRequest',
    entityId: id,
    approverUserId: user.id,
    action: 'APPROVED',
    previousStatus: request.status
  });
  // Notify the employee that their profile update was approved
  const profileEmployee = await prisma.employee.findUnique({
    where: { id: request.employeeId },
    include: { user: true }
  });
  if (profileEmployee?.user?.id) {
    await NotificationService.notify({
      userId: profileEmployee.user.id,
      category: 'approval',
      title: 'Profile Update Approved',
      message: `Your request to update "${request.fieldName}" has been approved.`,
      deepLink: '/EmployeeSelfService'
    });
  }
  return updatedRequest;
},
rejectProfileUpdateRequest: async (_, {
  id,
  reason
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  const request = await prisma.profileUpdateRequest.findUnique({
    where: {
      id
    }
  });
  const updatedRequest = await prisma.profileUpdateRequest.update({
    where: {
      id
    },
    data: {
      status: 'REJECTED',
      reviewedBy: user.id
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'ProfileUpdateRequest',
    entityId: id,
    action: 'REJECT'
  });
  await recordApprovalEvent({
    entityType: 'ProfileUpdateRequest',
    entityId: id,
    approverUserId: user.id,
    action: 'REJECTED',
    comments: reason,
    previousStatus: request.status
  });
  return updatedRequest;
},
// Phase 3 Mutations
requestCompensationUpdate: async (_, {
  employeeId,
  basicSalary,
  allowances,
  reason
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['HR_ADMIN', 'SUPER_ADMIN']);
  const record = await prisma.salaryHistory.create({
    data: {
      employeeId,
      basicSalary,
      allowances: allowances ? JSON.parse(allowances) : null,
      effectiveDate: new Date(),
      reason,
      status: 'PENDING'
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id, organizationId: user.organizationId,
    entityType: 'SalaryHistory',
    entityId: record.id,
    action: 'CREATED',
    previousValue: {
      basicSalary: employee.basicSalary,
      allowances: employee.allowances
    },
    newValue: record,
    ipAddress
  });
  return record;
},
submitPayrollRun: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
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
      status: 'PENDING_APPROVAL'
    }
  });
  await recordApprovalEvent({
    entityType: 'PayrollRun',
    entityId: id,
    approverUserId: user.id,
    action: 'PENDING_APPROVAL',
    previousStatus: pr.status
  });
  return updated;
},
rejectPayrollRun: async (_, {
  id,
  reason
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
      status: 'REJECTED'
    }
  });
  await recordApprovalEvent({
    entityType: 'PayrollRun',
    entityId: id,
    approverUserId: user.id,
    action: 'REJECTED',
    comments: reason,
    previousStatus: pr.status
  });
  return updated;
},
generatePayslip: async (_, {
  recordId
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  // To implement a real PDF generation async worker:
  // 1. Push a job to BullMQ queue: `pdfQueue.add('generatePayslip', { recordId })`.
  // 2. The worker would fetch the PayrollRecord and render a Handlebars HTML template.
  // 3. The worker would launch Puppeteer, call `page.pdf()`, and upload the buffer to AWS S3.
  // 4. Update the PayrollRecord.payslipUrl with the S3 link.

  // For this MVP, we simulate it by returning a mock URL pointing to an HTML view or mock PDF.
  const mockPdfUrl = `/api/payslip/preview/${recordId}`;
  await prisma.payrollRecord.update({
    where: {
      id: recordId
    },
    data: {
      payslipUrl: mockPdfUrl
    }
  });
  return mockPdfUrl;
},
submitPolicy: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const pol = await prisma.policy.findUnique({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  const updated = await prisma.policy.update({
    where: {
      id,
      organizationId: user.organizationId
    },
    data: {
      status: 'PENDING'
    }
  });
  await recordApprovalEvent({
    entityType: 'Policy',
    entityId: id,
    approverUserId: user.id,
    action: 'PENDING',
    previousStatus: pol.status
  });
  return updated;
},
approvePolicy: async (_, {
  id
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN']);
  const pol = await prisma.policy.findUnique({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  const updated = await prisma.policy.update({
    where: {
      id,
      organizationId: user.organizationId
    },
    data: {
      status: 'APPROVED'
    }
  });
  await recordApprovalEvent({
    entityType: 'Policy',
    entityId: id,
    approverUserId: user.id,
    action: 'APPROVED',
    previousStatus: pol.status
  });
  return updated;
},
rejectPolicy: async (_, {
  id,
  reason
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN']);
  const pol = await prisma.policy.findUnique({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  const updated = await prisma.policy.update({
    where: {
      id,
      organizationId: user.organizationId
    },
    data: {
      status: 'REJECTED'
    }
  });
  await recordApprovalEvent({
    entityType: 'Policy',
    entityId: id,
    approverUserId: user.id,
    action: 'REJECTED',
    comments: reason,
    previousStatus: pol.status
  });
  return updated;
},
acknowledgePolicy: async (_, {
  policyId
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  await prisma.policyAcknowledgment.upsert({
    where: {
      policyId_userId: {
        policyId,
        userId: user.id
      }
    },
    update: {},
    create: {
      policyId,
      userId: user.id
    }
  });
  return true;
},
createOnboardingTask: async (_, {
  employeeId,
  title,
  description,
  category,
  assignedTo,
  dueDate
}, {
  prisma,
  requireAuth
}) => {
  requireAuth();
  return prisma.onboardingTask.create({
    data: {
      employeeId,
      title,
      description,
      category,
      assignedTo,
      dueDate: dueDate ? new Date(dueDate) : null
    }
  });
},
updateOnboardingTask: async (_, {
  id,
  status,
  isCompleted
}, {
  prisma,
  requireAuth
}) => {
  requireAuth();
  const data = {};
  if (status !== undefined) {
    data.status = status;
    if (status === 'done') {
      data.isCompleted = true;
      data.completedAt = new Date();
    } else {
      data.isCompleted = false;
      data.completedAt = null;
    }
  }
  if (isCompleted !== undefined) {
    data.isCompleted = isCompleted;
    if (isCompleted) data.completedAt = new Date();
  }
  return prisma.onboardingTask.update({
    where: {
      id
    },
    data
  });
},
initiateOffboarding: async (_, {
  employeeId,
  exitType,
  exitDate,
  reason
}, {
  prisma,
  requireRole
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  // Also update employee status
  await prisma.employee.update({
    where: {
      id: employeeId
    },
    data: {
      employmentStatus: 'OFFBOARDED'
    } // could be RESIGNED or TERMINATED based on exitType but sticking to OFFBOARDED
  });
  return prisma.offboarding.upsert({
    where: {
      employeeId
    },
    update: {
      exitType,
      exitDate: new Date(exitDate),
      reason
    },
    create: {
      employeeId,
      exitType,
      exitDate: new Date(exitDate),
      reason
    }
  });
},
updateOffboarding: async (_, {
  id,
  assetReturned,
  accessRevoked,
  handoverComplete
}, {
  prisma,
  requireRole
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const data = {};
  if (assetReturned !== undefined) data.assetReturned = assetReturned;
  if (accessRevoked !== undefined) data.accessRevoked = accessRevoked;
  if (handoverComplete !== undefined) data.handoverComplete = handoverComplete;
  return prisma.offboarding.update({
    where: {
      id
    },
    data
  });
}
  },
Notification: {
  isRead: parent => parent.isRead || false
},
AuditLog: {
  previousValue: parent => parent.previousValue ? JSON.stringify(parent.previousValue) : null,
  newValue: parent => parent.newValue ? JSON.stringify(parent.newValue) : null
},
ApprovalWorkflow: {
  steps: parent => parent.steps ? JSON.stringify(parent.steps) : '[]'
},
Department: {
  loans: async (_, __, {
    prisma,
    user,
    requireAuth
  }) => {
    requireAuth();
    const where = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) ? {} : {
      employeeId: user.employeeId
    };
    const loans = await prisma.loan.findMany({
      where,
      include: {
        employee: true
      }
    });
    return loans.map(l => ({
      ...l,
      employee_id: l.employeeId,
      employee_name: l.employee?.fullName,
      loan_type: 'standard',
      // For backward compat with UI
      loan_amount: l.amount,
      duration_months: Math.ceil(l.amount / l.monthlyRepayment),
      monthly_installment: l.monthlyRepayment,
      start_month: l.startDate.toISOString().slice(0, 7)
    }));
  },
  employees: async (parent, _, {
    prisma
  }) => {
    const emps = await prisma.employee.findMany({
      where: {
        departmentId: parent.id
      }
    });
    // Sort head employee first
    if (parent.headEmployeeId) {
      return emps.sort((a, b) => {
        if (a.id === parent.headEmployeeId) return -1;
        if (b.id === parent.headEmployeeId) return 1;
        return 0;
      });
    }
    return emps;
  }
}
};
