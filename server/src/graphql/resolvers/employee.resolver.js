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

export const employeeResolvers = {
  Query: {
employees: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  const emps = await prisma.employee.findMany({
    where: {
      organizationId: user.organizationId,
      employmentStatus: {
        notIn: ['RESIGNED', 'TERMINATED', 'OFFBOARDED']
      }
    }
  });
  return emps.map(emp => ({
    ...emp,
    hireDate: emp.hireDate ? emp.hireDate.toISOString() : null
  }));
},
employee: async (_, {
  id
}, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  return prisma.employee.findFirst({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
}
  },
  Mutation: {
createEmployee: async (_, {
  input
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
  const {
    templateId,
    employmentType,
    ...employeeData
  } = input;
  const count = await prisma.employee.count({
    where: {
      organizationId: user.organizationId
    }
  });
  const employeeCode = `EMP-${(count + 1).toString().padStart(6, '0')}`;
  let managerId = null;
  if (employeeData.departmentId) {
    const dept = await prisma.department.findUnique({
      where: {
        id: employeeData.departmentId
      }
    });
    if (dept?.headEmployeeId) managerId = dept.headEmployeeId;
  }
  if (!managerId) {
    const hrAdmin = await prisma.user.findFirst({
      where: {
        organizationId: user.organizationId,
        role: 'HR_ADMIN',
        employeeId: {
          not: null
        }
      }
    });
    if (hrAdmin) managerId = hrAdmin.employeeId;
  }
  const emp = await prisma.employee.create({
    data: {
      ...employeeData,
      employmentType: employmentType ? employmentType.toUpperCase() : 'FULL_TIME',
      employeeCode,
      organizationId: user.organizationId,
      hireDate: new Date(employeeData.hireDate),
      employmentStatus: 'DRAFT',
      onboardingStatus: 'not_started',
      managerId
    }
  });

  await prisma.employeeStatusHistory.create({
    data: {
      employeeId: emp.id,
      previousStatus: 'DRAFT',
      newStatus: 'DRAFT',
      changedBy: user.id,
      reason: 'Employee created'
    }
  });
  await createAuditLog({
    prisma,
    ipAddress,
    actorId: user.id,
    entityType: 'Employee',
    entityId: emp.id,
    action: 'CREATE',
    newValue: emp,
    ipAddress
  });

  // Auto-generate User account for the new employee
  const passwordHash = await hashPassword('Welcome123!');
  await prisma.user.create({
    data: {
      email: employeeData.email,
      passwordHash,
      role: 'EMPLOYEE',
      organizationId: user.organizationId,
      employeeId: emp.id,
      isActive: true
    }
  });
  return emp;
},
updateEmployee: async (_, {
  id,
  input,
  auditAction,
  auditContext
}, {
  prisma,
  user,
  requireRole,
  ipAddress
}) => {
  requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
  const existing = await prisma.employee.findFirst({
    where: {
      id,
      organizationId: user.organizationId
    }
  });
  if (!existing) throw new Error("Employee not found");
  const updateData = {
    ...input
  };
  const isHeadOfDepartment = updateData.isHeadOfDepartment;
  delete updateData.isHeadOfDepartment;
  if (input.dateOfBirth) {
    const dNum = Number(input.dateOfBirth);
    updateData.dateOfBirth = isNaN(dNum) ? new Date(input.dateOfBirth) : new Date(dNum);
  }
  if (input.hireDate) {
    const hNum = Number(input.hireDate);
    updateData.hireDate = isNaN(hNum) ? new Date(input.hireDate) : new Date(hNum);
  }
  if (input.probationStartDate) {
    const psNum = Number(input.probationStartDate);
    updateData.probationStartDate = isNaN(psNum) ? new Date(input.probationStartDate) : new Date(psNum);
  }
  if (input.probationEndDate) {
    const peNum = Number(input.probationEndDate);
    updateData.probationEndDate = isNaN(peNum) ? new Date(input.probationEndDate) : new Date(peNum);
  }
  if (input.employmentType) updateData.employmentType = input.employmentType.toUpperCase();
  if (input.employmentStatus) {
    let status = input.employmentStatus.toUpperCase();
    if (status === 'ON_LEAVE') status = 'ACTIVE'; // Fallback since ON_LEAVE is not in enum
    updateData.employmentStatus = status;
  }

  // Auto-calculate probationEndDate if missing
  if (updateData.employmentStatus === 'PROBATION' && !updateData.probationEndDate) {
    const startDate = updateData.probationStartDate || existing.probationStartDate || updateData.hireDate || existing.hireDate;
    if (startDate) {
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 3);
      updateData.probationEndDate = endDate;
    }
  }
  if (input.departmentId !== undefined && input.departmentId !== existing.departmentId && input.managerId === undefined) {
    let managerId = null;
    if (input.departmentId) {
      const dept = await prisma.department.findUnique({
        where: {
          id: input.departmentId
        }
      });
      if (dept?.headEmployeeId) managerId = dept.headEmployeeId;
    }
    if (!managerId) {
      const hrAdmin = await prisma.user.findFirst({
        where: {
          organizationId: user.organizationId,
          role: 'HR_ADMIN',
          employeeId: {
            not: null
          }
        }
      });
      if (hrAdmin) managerId = hrAdmin.employeeId;
    }
    updateData.managerId = managerId;
  }

  // Auto-promotion is now handled after the update by checkAndPromoteEmployee

  const updated = await prisma.employee.update({
    where: {
      id
    },
    data: updateData
  });

  if (updateData.employmentStatus && updateData.employmentStatus !== existing.employmentStatus) {
    await prisma.employeeStatusHistory.create({
      data: {
        employeeId: id,
        previousStatus: existing.employmentStatus,
        newStatus: updateData.employmentStatus,
        changedBy: user.id,
        reason: 'Status updated via edit'
      }
    });
  }

  // Update department head if requested
  if (isHeadOfDepartment) {
    const targetDeptId = updateData.departmentId || existing.departmentId;
    if (targetDeptId) {
      await prisma.department.update({
        where: {
          id: targetDeptId
        },
        data: {
          headEmployeeId: id
        }
      });
      // Also upgrade user role to MANAGER if needed
      await prisma.user.updateMany({
        where: {
          employeeId: id,
          role: 'EMPLOYEE'
        },
        data: {
          role: 'MANAGER'
        }
      });

      // Re-assign all other employees in the department to report to this new manager
      await prisma.employee.updateMany({
        where: {
          departmentId: targetDeptId,
          id: {
            not: id
          }
        },
        data: {
          managerId: id
        }
      });

      // Ensure the new department head reports to HR
      const hrAdmin = await prisma.user.findFirst({
        where: {
          organizationId: user.organizationId,
          role: 'HR_ADMIN',
          employeeId: {
            not: null
          }
        }
      });
      if (hrAdmin) {
        await prisma.employee.update({
          where: {
            id
          },
          data: {
            managerId: hrAdmin.employeeId
          }
        });
      }
    }
  }
  const actionString = auditAction || 'UPDATE';
  const actionWithContext = auditContext ? `${actionString} - ${auditContext}` : actionString;
  await createAuditLog({
    prisma,
    ipAddress,
    actorId: user.id,
    entityType: 'Employee',
    entityId: id,
    action: actionWithContext,
    previousValue: existing,
    newValue: updated
  });
  if (auditAction === 'PROMOTE') {
    const usr = await prisma.user.findUnique({
      where: {
        employeeId: id
      }
    });
    if (usr) {
      await NotificationService.notify({
        userId: usr.id,
        category: 'promotion',
        title: 'Congratulations on your promotion! 🎉',
        message: `Your employment profile has been updated with a new promotion: ${auditContext}`,
        emailProps: {
          newTitle: updateData.jobTitle || existing.jobTitle,
          newGrade: updateData.employeeGrade || existing.employeeGrade,
          newClass: updateData.employeeClass || existing.employeeClass,
          effectiveDate: new Date().toLocaleDateString()
        },
        deepLink: '/EmployeeSelfService',
        sendEmail: true
      });
    }

    // Dynamically recalculate and apply benefits
    if (updateData.employeeGrade || existing.employeeGrade) {
      await applyDynamicBenefits(id, updateData.employeeGrade || existing.employeeGrade, prisma);
    }
  }
  await checkAndPromoteEmployee(id, prisma);
  return updated;
}
  },
Employee: {
  department: async (parent, _, {
    prisma
  }) => {
    if (!parent.departmentId) return null;
    return prisma.department.findUnique({
      where: {
        id: parent.departmentId
      }
    });
  },
  manager: async (parent, _, {
    prisma
  }) => {
    if (!parent.managerId) return null;
    return prisma.employee.findUnique({
      where: {
        id: parent.managerId
      }
    });
  },
  basicSalary: (parent, _, {
    user
  }) => {
    return user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id ? parent.basicSalary : null;
  },
  allowances: (parent, _, {
    user
  }) => {
    return user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id ? parent.allowances : null;
  },
  bankName: (parent, _, {
    user
  }) => {
    return user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id ? parent.bankName : null;
  },
  bankAccountNumber: (parent, _, {
    user
  }) => {
    return user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id ? parent.bankAccountNumber : null;
  },
  pensionId: (parent, _, {
    user
  }) => {
    return user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id ? parent.pensionId : null;
  },
  nationalId: (parent, _, {
    user
  }) => {
    return user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id ? parent.nationalId : null;
  },
  passportNumber: (parent, _, {
    user
  }) => {
    return user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id ? parent.passportNumber : null;
  },
  promotionHistory: async (parent, _, {
    prisma
  }) => {
    return prisma.promotionHistory.findMany({
      where: {
        employeeId: parent.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  },
  statusHistory: async (parent, _, {
    prisma
  }) => {
    return prisma.employeeStatusHistory.findMany({
      where: {
        employeeId: parent.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}
};
