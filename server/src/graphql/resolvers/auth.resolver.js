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

export const authResolvers = {
  Query: {
me: async (_, __, {
  prisma,
  user,
  requireAuth
}) => {
  requireAuth();
  return prisma.user.findUnique({
    where: {
      id: user.id
    }
  });
}
  },
  Mutation: {
register: async (_, {
  input
}, {
  prisma
}) => {
  try {
    const {
      email,
      password,
      orgName
    } = input;
  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  });
  if (existingUser) throw new Error("Email already in use");
  const passwordHash = await hashPassword(password);
  const organization = await prisma.organization.create({
    data: {
      name: orgName,
      ownerEmail: email
    }
  });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      organizationId: organization.id,
      isOrgOwner: true
    }
  });
  const token = generateToken(user);
    return {
      token,
      user
    };
  } catch (error) {
    console.error("Error in register:", error);
    if (error.message === "Email already in use") throw error;
    if (error.code === 'P2002') {
      throw new Error("Email already in use");
    }
    throw new Error("Failed to register. Please try again later.");
  }
},
login: async (_, {
  email,
  password
}, {
  prisma,
  ipAddress
}) => {
  try {
  const user = await prisma.user.findUnique({
    where: {
      email
    }
  });
  if (!user) throw new Error("Invalid credentials");
  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) throw new Error("Invalid credentials");
  const token = generateToken(user);

  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id,
    organizationId: user.organizationId,
    entityType: 'User',
    entityId: user.id,
    action: 'LOGIN'
  });

    return {
      token,
      user
    };
  } catch (error) {
    console.error("Error in login:", error);
    if (error.message === "Invalid credentials") throw error;
    throw new Error("An error occurred during login. Please try again.");
  }
},
logout: async (_, __, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  await createAuditLog({
    prisma,
    ipAddress,
    userId: user.id,
    organizationId: user.organizationId,
    entityType: 'User',
    entityId: user.id,
    action: 'LOGOUT'
  });
  return true;
},
clearProfileGate: async (_, __, {
  prisma,
  user,
  requireAuth,
  ipAddress
}) => {
  requireAuth();
  const updatedUser = await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      mustCompleteProfile: false,
      lastLogin: new Date()
    }
  });

  if (user.employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: user.employeeId } });
    if (employee && employee.employmentStatus === 'DRAFT') {
      await prisma.employee.update({
        where: { id: user.employeeId },
        data: { employmentStatus: 'PENDING_APPROVAL' }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          action: 'SUBMIT_PROFILE',
          entityType: 'Employee',
          entityId: user.employeeId,
          ipAddress,
          details: { message: 'Employee submitted profile for review' }
        }
      });

      // Notify HR Admins and Super Admins
      const hrAdmins = await prisma.user.findMany({
        where: { 
          organizationId: user.organizationId, 
          role: { in: ['HR_ADMIN', 'SUPER_ADMIN'] }
        }
      });
      
      const notifications = hrAdmins.map(hr => ({
        userId: hr.id,
        category: 'approval',
        title: 'New Employee Profile Review',
        message: `${employee.fullName} has completed their profile setup and is awaiting review.`,
        channel: 'IN_APP',
        deepLink: `/approvals`
      }));
      
      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }
    }
  }

  return updatedUser;
}
  },
};
