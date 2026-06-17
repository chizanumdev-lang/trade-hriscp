import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { v2 as cloudinary } from 'cloudinary';
import { createAuditLog, recordApprovalEvent } from '../utils/audit.js';
import { NotificationService } from '../services/NotificationService.js';
import { client as triggerClient } from '../jobs/trigger.js';
import { applyDynamicBenefits, calculateBenefits } from '../utils/benefitsMatrix.js';

const checkAndPromoteEmployee = async (employeeId, prisma) => {
  const emp = await prisma.employee.findUnique({ 
    where: { id: employeeId },
    include: { department: true }
  });
  if (!emp || emp.employmentStatus !== 'DRAFT') return;

  // Auto-assign manager if missing
  let currentManagerId = emp.managerId;
  if (!currentManagerId) {
    if (emp.department?.headEmployeeId) {
      currentManagerId = emp.department.headEmployeeId;
    } else {
      const hrAdmin = await prisma.user.findFirst({
        where: { organizationId: emp.organizationId, role: 'HR_ADMIN', employeeId: { not: null } }
      });
      if (hrAdmin) {
        currentManagerId = hrAdmin.employeeId;
      }
    }
    
    if (currentManagerId) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { managerId: currentManagerId }
      });
    }
  }

  const isComplete = 
    emp.phone && 
    emp.privateEmail && 
    emp.dateOfBirth && 
    emp.gender && 
    emp.maritalStatus && 
    emp.nationality && 
    emp.nationalId && 
    emp.passportNumber &&
    currentManagerId;

  if (isComplete) {
    const docCount = await prisma.document.count({ where: { employeeId } });
    if (docCount > 0) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus: 'PENDING_APPROVAL' }
      });

      // Notify the manager or HR about the pending approval
      if (currentManagerId) {
        const managerUser = await prisma.user.findFirst({
          where: { employeeId: currentManagerId }
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

export const resolvers = {
  Query: {
        auditLogs: async (_, { entityType, action, limit }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const where = {};
      if (entityType) where.entityType = entityType;
      if (action) where.action = action;
      const logs = await prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, take: limit || 100, include: { actor: true }
      });
      return logs.map(log => ({
        ...log,
        previousValue: log.previousValue ? JSON.stringify(log.previousValue) : null,
        newValue: log.newValue ? JSON.stringify(log.newValue) : null,
      }));
    },
me: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.user.findUnique({ where: { id: user.id } });
    },
    organization: async (_, { id }, { prisma, requireAuth }) => {
      requireAuth();
      return prisma.organization.findUnique({ where: { id } });
    },
    
    loans: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      const where = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) 
        ? {} 
        : { employeeId: user.employeeId };
        
      const loans = await prisma.loan.findMany({
        where,
        include: { employee: true }
      });
      
      return loans.map(l => ({
        ...l,
        employee_id: l.employeeId,
        employee_name: l.employee?.fullName,
        loan_type: 'standard', // For backward compat with UI
        loan_amount: l.amount,
        duration_months: Math.ceil(l.amount / l.monthlyRepayment),
        monthly_installment: l.monthlyRepayment,
        start_month: l.startDate.toISOString().slice(0, 7)
      }));
    },
    paginatedLoans: async (_, { page = 1, limit = 10, employeeId }, { prisma, user, requireAuth }) => {
      requireAuth();
      const skip = (page - 1) * limit;
      const where = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) 
        ? {} 
        : { employeeId: user.employeeId };
        
      if (employeeId && ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
          where.employeeId = employeeId;
      }

      const [loansData, totalCount] = await Promise.all([
        prisma.loan.findMany({
          where,
          skip,
          take: limit,
          include: { employee: true },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.loan.count({ where })
      ]);
      
      const mappedLoans = loansData.map(l => ({
        ...l,
        employee_id: l.employeeId,
        employee_name: l.employee?.fullName,
        loan_type: 'standard', // For backward compat with UI
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
    employees: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      const emps = await prisma.employee.findMany({ 
        where: { 
          organizationId: user.organizationId,
          employmentStatus: { notIn: ['RESIGNED', 'TERMINATED', 'OFFBOARDED'] }
        } 
      });
      return emps.map(emp => ({
        ...emp,
        hireDate: emp.hireDate ? emp.hireDate.toISOString() : null
      }));
    },
    paginatedEmployees: async (_, { page = 1, limit = 10, search = "", status = "all", employmentStatus = "all" }, { prisma, user, requireAuth }) => {
      requireAuth();
      const skip = (page - 1) * limit;
      
      const where = {
        organizationId: user.organizationId,
      };

      if (employmentStatus && employmentStatus !== "all") {
        where.employmentStatus = employmentStatus.toUpperCase();
      } else {
        where.employmentStatus = { notIn: ['RESIGNED', 'TERMINATED', 'OFFBOARDED'] };
      }

      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { jobTitle: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (status && status !== "all") {
        if (status === "not_started") {
          where.OR = where.OR ? [...where.OR] : []; // simplified approach, let's just add to where
          where.onboardingStatus = { in: ['not_started', null, ''] }; // Need to handle nulls mapping to not_started
        } else {
          where.onboardingStatus = status;
        }
      }

      const [emps, totalCount] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.employee.count({ where })
      ]);

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
    employee: async (_, { id }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      return prisma.employee.findFirst({
        where: { id, organizationId: user.organizationId }
      });
    },
    departments: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.department.findMany({ 
        where: { organizationId: user.organizationId },
        include: { employees: true }
      });
    },
    department: async (_, { id }, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.department.findFirst({
        where: { id, organizationId: user.organizationId },
        include: { employees: true }
      });
    },
    onboardingTasks: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      // To show everyone's tasks, we fetch all tasks in the org
      return prisma.onboardingTask.findMany({
        where: { employee: { organizationId: user.organizationId } },
        orderBy: { createdAt: 'desc' }
      });
    },
    shifts: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.shift.findMany({ where: { organizationId: user.organizationId } });
    },
    approvalWorkflows: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      const workflows = await prisma.approvalWorkflow.findMany({ where: { organizationId: user.organizationId } });
      return workflows.map(wf => ({
        ...wf,
        steps: wf.steps ? JSON.stringify(wf.steps) : '[]'
      }));
    },
    // Phase 2 Queries
    leaveTypes: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.leaveType.findMany({ where: { organizationId: user.organizationId } });
    },
    leaveRequests: async (_, { employeeId }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      const where = employeeId ? { employeeId } : {};
      // Should also restrict to organization but skipped for brevity
      return prisma.leaveRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
    },
    compensationBands: async (_, __, { user, prisma }) => {
      if (!user) throw new Error("Not authenticated");
      return prisma.compensationBand.findMany({
        where: { organizationId: user.organizationId }
      });
    },
    promotionRequests: async (_, { employeeId }, { user, prisma }) => {
      if (!user) throw new Error("Not authenticated");
      const where = employeeId ? { employeeId } : {};
      return prisma.promotionRequest.findMany({
        where,
        include: { employee: true, requestedBy: true, approvals: true },
        orderBy: { createdAt: 'desc' }
      });
    },
    previewPromotionBenefits: async (_, { employeeId, newGrade }, { user, prisma }) => {
      if (!user) throw new Error("Not authenticated");
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp) throw new Error("Employee not found");
      
      const { hmoPlan, annualLeaveDays, newBasicSalary } = await calculateBenefits(emp, newGrade, prisma);
      
      let oldLeaveDays = 0;
      const annualLeaveType = await prisma.leaveType.findFirst({
        where: { organizationId: emp.organizationId, name: { contains: 'Annual', mode: 'insensitive' } }
      });
      if (annualLeaveType) {
        const existingBalance = await prisma.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: annualLeaveType.id, year: new Date().getFullYear() } }
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
    paginatedLeaveRequests: async (_, { page = 1, limit = 10, employeeId }, { prisma, user, requireAuth }) => {
      requireAuth();
      const skip = (page - 1) * limit;
      const where = employeeId ? { employeeId } : {};
      
      const [leaveRequests, totalCount] = await Promise.all([
        prisma.leaveRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.leaveRequest.count({ where })
      ]);
      
      return {
        leaveRequests,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      };
    },
    myLeavePlans: async (_, { year }, { prisma, user, requireAuth }) => {
      requireAuth();
      const employee = await prisma.employee.findUnique({ where: { email: user.email } });
      if (!employee) throw new Error("Employee record not found for this user");
      return prisma.leavePlan.findMany({
        where: { employeeId: employee.id, year },
        include: { employee: true }
      });
    },
    teamLeavePlans: async (_, { year }, { prisma, user, requireAuth }) => {
      requireAuth();
      if (['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        return prisma.leavePlan.findMany({
          where: { year },
          include: { employee: true }
        });
      }
      const employee = await prisma.employee.findUnique({ where: { email: user.email } });
      if (!employee) return [];
      return prisma.leavePlan.findMany({
        where: { 
          year,
          employee: { managerId: employee.id }
        },
        include: { employee: true }
      });
    },
    attendanceRecords: async (_, { employeeId, date }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      const where = {};
      if (employeeId) where.employeeId = employeeId;
      if (date) where.date = new Date(date);
      return prisma.attendance.findMany({ where, orderBy: { date: 'desc' } });
    },
    documents: async (_, { employeeId, category }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      const where = {};
      
      if (category) where.category = category;

      if (['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        if (employeeId) where.employeeId = employeeId;
        where.status = { in: ['ACTIVE', 'PENDING', 'ARCHIVED'] };
        return prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
      }
      
      if (user.role === 'EMPLOYEE') {
        if (employeeId && employeeId !== user.employeeId) {
          throw new Error("Cannot view documents for other employees");
        }
        where.employeeId = user.employeeId;
        where.status = { in: ['ACTIVE', 'PENDING'] };
        where.visibilityLevel = { in: ['employee', 'all', 'EMPLOYEE', 'ALL'] };
        return prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
      }
      
      if (user.role === 'MANAGER') {
        if (!employeeId) {
           const reports = await prisma.employee.findMany({ where: { managerId: user.employeeId }, select: { id: true } });
           where.employeeId = { in: reports.map(r => r.id) };
        } else {
           const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
           if (emp && emp.managerId !== user.employeeId && employeeId !== user.employeeId) {
             throw new Error("Not authorized to view this employee's documents");
           }
           where.employeeId = employeeId;
        }
        where.status = 'ACTIVE';
        if (employeeId === user.employeeId) {
           where.visibilityLevel = { in: ['employee', 'all'] };
        } else {
           where.visibilityLevel = { in: ['manager', 'all'] };
        }
        return prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
      }
      
      return [];
    },
    documentHistory: async (_, { documentId }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { version: 'desc' }
      });
    },
    getCloudinarySignature: async (_, __, { user, requireAuth }) => {
      requireAuth();
      
      const timestamp = Math.round((new Date).getTime() / 1000);
      
      const signature = cloudinary.utils.api_sign_request(
        { timestamp }, 
        process.env.CLOUDINARY_API_SECRET
      );
      
      return {
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME
      };
    },
    notifications: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    },
    
    salaryHistory: async (_, { employeeId }, { prisma, requireAuth }) => {
      requireAuth();
      return prisma.salaryHistory.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' }
      });
    },

    // Phase 3 Queries
    payrollRuns: async (_, __, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
      return prisma.payrollRun.findMany({ where: { organizationId: user.organizationId }, orderBy: { month: 'desc' } });
    },
    payrollRecords: async (_, { payrollRunId }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
      return prisma.payrollRecord.findMany({ where: { payrollRunId } });
    },
    myPayrollRecords: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      if (!user.employeeId) return [];
      return prisma.payrollRecord.findMany({ where: { employeeId: user.employeeId } });
    },
    
    // Phase 4 Queries
    policies: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.policy.findMany({ where: { organizationId: user.organizationId } });
    },
    announcements: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.announcement.findMany({ where: { organizationId: user.organizationId }, orderBy: { createdAt: 'desc' } });
    },
    goals: async (_, { employeeId }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      return prisma.goal.findMany({ where: { employeeId } });
    },
    profileUpdateRequests: async (_, __, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      // Should filter by organizationId, but profileUpdateRequest only has employeeId
      // We will fetch where employee.organizationId == user.organizationId
      return prisma.profileUpdateRequest.findMany({
        where: { employee: { organizationId: user.organizationId } },
        include: { employee: true },
        orderBy: { createdAt: 'desc' }
      });
    },
    
    // Phase 5 & 6 Queries
    checkIns: async (_, { employeeId }, { prisma, requireAuth }) => {
      requireAuth();
      return prisma.checkIn.findMany({ where: { employeeId }, orderBy: { period: 'desc' } });
    },
    onboardingTasks: async (_, { employeeId }, { prisma, requireAuth }) => {
      requireAuth();
      const where = employeeId ? { employeeId } : {};
      return prisma.onboardingTask.findMany({ where });
    },
    offboardingDetails: async (_, { employeeId }, { prisma, requireAuth }) => {
      requireAuth();
      return prisma.offboarding.findUnique({ where: { employeeId } });
    },
    allOffboardings: async (_, __, { prisma, requireAuth }) => {
      requireAuth();
      return prisma.offboarding.findMany({
        include: { employee: true }
      });
    },
    upcomingCelebrations: async (_, { month }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      const employees = await prisma.employee.findMany({
        where: { organizationId: user.organizationId, employmentStatus: 'ACTIVE' },
        select: { id: true, fullName: true, dateOfBirth: true, hireDate: true }
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
    register: async (_, { input }, { prisma }) => {
      const { email, password, orgName } = input;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) throw new Error("Email already in use");
      const passwordHash = await hashPassword(password);
      const organization = await prisma.organization.create({
        data: { name: orgName, ownerEmail: email }
      });
      const user = await prisma.user.create({
        data: { email, passwordHash, role: 'SUPER_ADMIN', organizationId: organization.id, isOrgOwner: true }
      });
      const token = generateToken(user);
      return { token, user };
    },
    login: async (_, { email, password }, { prisma }) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new Error("Invalid credentials");
      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) throw new Error("Invalid credentials");
      const token = generateToken(user);
      return { token, user };
    },
    createEmployee: async (_, { input }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const { templateId, employmentType, ...employeeData } = input;
      const count = await prisma.employee.count({ where: { organizationId: user.organizationId } });
      const employeeCode = `EMP-${(count + 1).toString().padStart(6, '0')}`;
      
      let managerId = null;
      if (employeeData.departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: employeeData.departmentId } });
        if (dept?.headEmployeeId) managerId = dept.headEmployeeId;
      }
      if (!managerId) {
        const hrAdmin = await prisma.user.findFirst({
          where: { organizationId: user.organizationId, role: 'HR_ADMIN', employeeId: { not: null } }
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
          managerId,
        }
      });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Employee', entityId: emp.id, action: 'CREATE', newValue: emp, ipAddress });
      
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
    approveEmployeeData: async (_, { employeeId }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      
      const emp = await prisma.employee.findFirst({
        where: { id: employeeId, organizationId: user.organizationId }
      });
      
      if (!emp) throw new Error("Employee not found");
      if (emp.employmentStatus !== 'PENDING_APPROVAL') {
        throw new Error("Employee is not in PENDING_APPROVAL state");
      }
      
      const pendingDocs = await prisma.document.count({
        where: { employeeId: emp.id, status: 'PENDING' }
      });
      
      if (pendingDocs > 0) {
        throw new Error(`Cannot approve employee profile: ${pendingDocs} document(s) are pending approval. Please review and approve all documents first.`);
      }
      
      // Update employee status to PENDING_ONBOARDING
      const updatedEmp = await prisma.employee.update({
        where: { id: employeeId },
        data: {
          employmentStatus: 'PENDING_ONBOARDING',
        }
      });
      
      await createAuditLog({
        prisma,
        userId: user.id,
        organizationId: user.organizationId,
        action: 'APPROVE_EMPLOYEE_DATA',
        entityType: 'Employee',
        entityId: emp.id,
        details: { previousStatus: 'PENDING_APPROVAL', newStatus: 'PENDING_ONBOARDING' }
      });
      
      return updatedEmp;
    },

    startOnboarding: async (_, { employeeId }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      
      const emp = await prisma.employee.findFirst({
        where: { id: employeeId, organizationId: user.organizationId }
      });
      
      if (!emp) throw new Error("Employee not found");
      if (emp.employmentStatus !== 'PENDING_ONBOARDING') {
        throw new Error("Employee is not in PENDING_ONBOARDING state");
      }
      
      // Update employee status
      const updatedEmp = await prisma.employee.update({
        where: { id: employeeId },
        data: {
          employmentStatus: 'ONGOING_ONBOARDING',
          onboardingStatus: 'in_progress'
        }
      });
      
      // Generate onboarding tasks
      const tasks = [
        { title: 'IT setup', category: 'it_setup' },
        { title: 'Laptop provision', category: 'it_setup' },
        { title: 'Workspace setup', category: 'orientation' },
        { title: 'System access', category: 'it_setup' }
      ];
      
      for (const task of tasks) {
        await prisma.onboardingTask.create({
          data: {
            employeeId: emp.id,
            title: task.title,
            category: task.category,
            assignedTo: emp.fullName,
          }
        });
      }
      
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Employee', entityId: emp.id, action: 'START_ONBOARDING', ipAddress });
      
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
    
    suspendEmployee: async (_, { id, input }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(context.user.role)) {
        throw new Error('Not authorized');
      }

      return await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.update({
          where: { id },
          data: { employmentStatus: 'SUSPENDED' },
          include: { department: true, organization: true }
        });

        await tx.suspension.create({
          data: {
            employeeId: id,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            reason: input.reason,
            approvedBy: input.superAdminApproved ? "SuperAdmin" : null
          }
        });

        await tx.auditLog.create({
          data: {
            organizationId: employee.organizationId,
            userId: context.user.id,
            action: 'SUSPEND',
            entityType: 'EMPLOYEE',
            entityId: id,
            details: { 
              reason: input.reason,
              startDate: input.startDate,
              endDate: input.endDate,
              superAdminApproved: input.superAdminApproved
            }
          }
        });

        return employee;
      });
    },

    offboardEmployee: async (_, { id, input }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(context.user.role)) {
        throw new Error('Not authorized');
      }

      return await prisma.$transaction(async (tx) => {
        // Find existing to avoid unique constraint if re-offboarding (optional), but let's just create or update
        // We will use upsert for Offboarding to prevent unique constraint errors if the record somehow exists
        const offboarding = await tx.offboarding.upsert({
          where: { employeeId: id },
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
          where: { id },
          data: { employmentStatus: statusMap[input.exitType] || 'OFFBOARDED' },
          include: { department: true, organization: true }
        });

        await tx.auditLog.create({
          data: {
            organizationId: employee.organizationId,
            userId: context.user.id,
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

    
    updateOrganizationFeatures: async (_, { strictLeaveNotice }, { prisma, user, requireAuth }) => {
      requireAuth();
      if (!user.organizationId) throw new Error("Not in an organization");
      if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) throw new Error("Not authorized");
      
      const org = await prisma.organization.findUnique({ where: { id: user.organizationId }});
      const features = org.featuresEnabled || {};
      features.strictLeaveNotice = strictLeaveNotice;

      return await prisma.organization.update({
        where: { id: user.organizationId },
        data: { featuresEnabled: features }
      });
    },

    
    createLoan: async (_, { input }, { prisma, user, requireAuth }) => {
      requireAuth();
      
      const employeeId = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) 
        ? input.employee_id 
        : user.employeeId;
        
      if (!employeeId) throw new Error("Employee not found");
      
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
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
    
    upsertCompensationBand: async (_, { input }, { user, prisma }) => {
      if (!user || user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN') throw new Error("Not authorized");
      const { grade, minSalary, maxSalary, hmoPlan, annualLeaveDays } = input;
      
      return prisma.compensationBand.upsert({
        where: {
          organizationId_grade: {
            organizationId: user.organizationId,
            grade
          }
        },
        update: { minSalary, maxSalary, hmoPlan, annualLeaveDays },
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
    
    requestPromotion: async (_, { input }, { user, prisma }) => {
      if (!user) throw new Error("Not authenticated");
      const { employeeId, effectiveDate, ...rest } = input;
      
      const req = await prisma.promotionRequest.create({
        data: {
          employeeId,
          requestedById: user.id,
          effectiveDate: new Date(effectiveDate),
          status: 'PENDING',
          isExecuted: false,
          ...rest
        }
      });
  
      await prisma.approvalRecord.create({
        data: {
          entityType: 'PromotionRequest',
          entityId: req.id,
          approverUserId: user.id,
          action: 'PENDING',
          promotionRequestId: req.id
        }
      });
  
      return req;
    },
    
    approvePromotion: async (_, { id, status, comments }, { user, prisma }) => {
      if (!user) throw new Error("Not authenticated");
      
      const req = await prisma.promotionRequest.update({
        where: { id },
        data: { status }
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
      if (status === 'APPROVED' && new Date(req.effectiveDate) <= new Date()) {
        await prisma.employee.update({
          where: { id: req.employeeId },
          data: {
            jobTitle: req.newJobTitle || undefined,
            departmentId: req.newDepartmentId || undefined,
            employeeClass: req.newEmployeeClass || undefined,
            employeeGrade: req.newEmployeeGrade || undefined
          }
        });
        if (req.isHeadOfDepartment && req.newDepartmentId) {
          await prisma.department.update({
            where: { id: req.newDepartmentId },
            data: { headEmployeeId: req.employeeId }
          });
        }
        if (req.newEmployeeGrade) {
          await applyDynamicBenefits(req.employeeId, req.newEmployeeGrade, prisma);
        }
        await prisma.promotionRequest.update({
          where: { id },
          data: { isExecuted: true }
        });
      }
  
      return req;
    },
    
    updateEmployee: async (_, { id, input, auditAction, auditContext }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      
      const existing = await prisma.employee.findFirst({
        where: { id, organizationId: user.organizationId }
      });
      if (!existing) throw new Error("Employee not found");
      
      const updateData = { ...input };
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
          const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
          if (dept?.headEmployeeId) managerId = dept.headEmployeeId;
        }
        if (!managerId) {
          const hrAdmin = await prisma.user.findFirst({
            where: { organizationId: user.organizationId, role: 'HR_ADMIN', employeeId: { not: null } }
          });
          if (hrAdmin) managerId = hrAdmin.employeeId;
        }
        updateData.managerId = managerId;
      }
      
      // Auto-promotion is now handled after the update by checkAndPromoteEmployee
      
      const updated = await prisma.employee.update({
        where: { id },
        data: updateData
      });
      
      // Update department head if requested
      if (isHeadOfDepartment) {
        const targetDeptId = updateData.departmentId || existing.departmentId;
        if (targetDeptId) {
          await prisma.department.update({
            where: { id: targetDeptId },
            data: { headEmployeeId: id }
          });
          // Also upgrade user role to MANAGER if needed
          await prisma.user.updateMany({
            where: { employeeId: id, role: 'EMPLOYEE' },
            data: { role: 'MANAGER' }
          });
          
          // Re-assign all other employees in the department to report to this new manager
          await prisma.employee.updateMany({
            where: { departmentId: targetDeptId, id: { not: id } },
            data: { managerId: id }
          });
          
          // Ensure the new department head reports to HR
          const hrAdmin = await prisma.user.findFirst({
            where: { organizationId: user.organizationId, role: 'HR_ADMIN', employeeId: { not: null } }
          });
          if (hrAdmin) {
            await prisma.employee.update({
              where: { id },
              data: { managerId: hrAdmin.employeeId }
            });
          }
        }
      }
      
      const actionString = auditAction || 'UPDATE';
      const actionWithContext = auditContext ? `${actionString} - ${auditContext}` : actionString;
      
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Employee', entityId: id, action: actionWithContext, previousValue: existing, newValue: updated });
      
      if (auditAction === 'PROMOTE') {
        const usr = await prisma.user.findUnique({ where: { employeeId: id } });
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
    },
    updateEmployeeSelf: async (_, { input }, { prisma, user, ipAddress }) => {
      if (!user) throw new Error("Not authenticated");
      const existing = await prisma.employee.findFirst({
        where: { 
          organizationId: user.organizationId,
          ...(user.employeeId ? { id: user.employeeId } : { email: user.email })
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
        where: { id: existing.id },
        data: updateData
      });
      
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Employee', entityId: existing.id, action: 'UPDATE_SELF', previousValue: existing, newValue: updated });
      await checkAndPromoteEmployee(existing.id, prisma);
      return updated;
    },
    deleteEmployee: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const empToDelete = await prisma.employee.findUnique({ where: { id } });
      await prisma.employee.delete({ where: { id, organizationId: user.organizationId } });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Employee', entityId: id, action: 'DELETE', previousValue: empToDelete });
      return true;
    },

    createDepartment: async (_, { name, code, headEmployeeId }, { prisma, user, requireRole, ipAddress }) => {
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
        const headUser = await prisma.user.findUnique({ where: { employeeId: headEmployeeId } });
        if (headUser && headUser.role === 'EMPLOYEE') {
          await prisma.user.update({ where: { id: headUser.id }, data: { role: 'MANAGER' } });
        }
        await prisma.employee.updateMany({
          where: { departmentId: department.id },
          data: { managerId: headEmployeeId }
        });
      }
      return department;
    },
    
    updateDepartment: async (_, { id, name, code, headEmployeeId }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const department = await prisma.department.findUnique({ where: { id, organizationId: user.organizationId } });
      if (!department) throw new Error("Department not found");
      
      const updated = await prisma.department.update({
        where: { id },
        data: { name, code, headEmployeeId }
      });
      
      if (headEmployeeId && department.status === 'APPROVED') {
        const headUser = await prisma.user.findUnique({ where: { employeeId: headEmployeeId } });
        if (headUser && headUser.role === 'EMPLOYEE') {
          await prisma.user.update({ where: { id: headUser.id }, data: { role: 'MANAGER' } });
        }
        await prisma.employee.updateMany({
          where: { departmentId: department.id },
          data: { managerId: headEmployeeId }
        });
      }
      return updated;
    },

    approveDepartment: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN']);
      const department = await prisma.department.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'APPROVED' }
      });
      
      if (department.headEmployeeId) {
        const headUser = await prisma.user.findUnique({ where: { employeeId: department.headEmployeeId } });
        if (headUser && headUser.role === 'EMPLOYEE') {
          await prisma.user.update({ where: { id: headUser.id }, data: { role: 'MANAGER' } });
        }
        await prisma.employee.updateMany({
          where: { departmentId: department.id },
          data: { managerId: department.headEmployeeId }
        });
      }
      return department;
    },

    deleteDepartment: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      await prisma.department.delete({
        where: { id, organizationId: user.organizationId }
      });
      return true;
    },

    createShift: async (_, { name, startTime, endTime, breakMinutes }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.shift.create({
        data: {
          name, startTime, endTime, breakMinutes: breakMinutes || 60,
          organizationId: user.organizationId
        }
      });
    },
    updateShift: async (_, { id, name, startTime, endTime, breakMinutes, isActive }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const data = {};
      if (name !== undefined) data.name = name;
      if (startTime !== undefined) data.startTime = startTime;
      if (endTime !== undefined) data.endTime = endTime;
      if (breakMinutes !== undefined) data.breakMinutes = breakMinutes;
      if (isActive !== undefined) data.isActive = isActive;
      return prisma.shift.update({
        where: { id, organizationId: user.organizationId },
        data
      });
    },
    deleteShift: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      await prisma.shift.delete({
        where: { id, organizationId: user.organizationId }
      });
      return true;
    },

    createApprovalWorkflow: async (_, { name, entityType, steps }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      let parsedSteps;
      try {
        parsedSteps = JSON.parse(steps);
      } catch(e) {
        throw new Error("Invalid JSON in steps");
      }
      return prisma.approvalWorkflow.create({
        data: {
          name, entityType, steps: parsedSteps,
          organizationId: user.organizationId
        }
      });
    },
    updateApprovalWorkflow: async (_, { id, name, entityType, steps, isActive }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const data = {};
      if (name !== undefined) data.name = name;
      if (entityType !== undefined) data.entityType = entityType;
      if (isActive !== undefined) data.isActive = isActive;
      if (steps !== undefined) {
        try {
          data.steps = JSON.parse(steps);
        } catch(e) {
          throw new Error("Invalid JSON in steps");
        }
      }
      return prisma.approvalWorkflow.update({
        where: { id, organizationId: user.organizationId },
        data
      });
    },
    deleteApprovalWorkflow: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      await prisma.approvalWorkflow.delete({
        where: { id, organizationId: user.organizationId }
      });
      return true;
    },
    
    processApproval: async (_, { entityType, entityId, action, comments }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      // Only MANAGER, HR_ADMIN, or SUPER_ADMIN can process approvals
      if (['EMPLOYEE'].includes(user.role)) {
        throw new Error("Not authorized to process approvals");
      }
      
      let previousStatus = null;
      
      if (entityType === 'ProfileUpdateRequest') {
        const request = await prisma.profileUpdateRequest.findUnique({ where: { id: entityId }, include: { employee: true } });
        if (!request) throw new Error("Request not found");
        previousStatus = request.status;
        
        await prisma.profileUpdateRequest.update({
          where: { id: entityId },
          data: { status: action, reviewedBy: user.id }
        });
        
        // If approved, dynamically update the employee record
        if (action === 'APPROVED') {
          const updateData = {};
          updateData[request.fieldName] = request.requestedValue;
          await prisma.employee.update({
            where: { id: request.employeeId },
            data: updateData
          });
        }
      } else if (entityType === 'LeaveRequest') {
        const request = await prisma.leaveRequest.findUnique({ where: { id: entityId }, include: { employee: true } });
        if (!request) throw new Error("LeaveRequest not found");
        previousStatus = request.status;
        
        let newStatus = action;
        if (action === 'APPROVED') {
          if (user.role === 'MANAGER' && previousStatus === 'PENDING') {
            newStatus = 'PENDING_HR';
          } else if (['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            newStatus = 'APPROVED';
          } else if (user.role === 'MANAGER' && previousStatus === 'PENDING_HR') {
            throw new Error("Already approved by Manager, waiting for HR");
          }
        }
        
        await prisma.leaveRequest.update({
          where: { id: entityId },
          data: { status: newStatus }
        });
        
        if (newStatus === 'APPROVED' && previousStatus !== 'APPROVED') {
          const year = new Date(request.startDate).getFullYear();
          const balance = await prisma.leaveBalance.findUnique({
            where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year } }
          });
          if (balance) {
            await prisma.leaveBalance.update({
              where: { id: balance.id },
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
        const request = await prisma.payrollRun.findUnique({ where: { id: entityId } });
        if (!request) throw new Error("PayrollRun not found");
        previousStatus = request.status;
        
        await prisma.payrollRun.update({
          where: { id: entityId },
          data: { status: action, approvedBy: user.id }
        });

        // Notify HR / Admin about payroll approval
        await NotificationService.notify({
          userId: request.processedBy || request.approvedBy || user.id, // Notify the original processor
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
        const request = await prisma.policy.findUnique({ where: { id: entityId } });
        if (!request) throw new Error("Policy not found");
        previousStatus = request.status;
        
        await prisma.policy.update({
          where: { id: entityId },
          data: { 
            status: action, 
            approvedBy: user.id,
            publishedAt: action === 'APPROVED' ? new Date() : request.publishedAt
          }
        });
      } else if (entityType === 'SalaryHistory') {
        const request = await prisma.salaryHistory.findUnique({ where: { id: entityId } });
        if (!request) throw new Error("Salary update request not found");
        previousStatus = request.status;
        
        await prisma.salaryHistory.update({
          where: { id: entityId },
          data: { status: action, approvedBy: user.id }
        });

        // If approved, dynamically update the employee record
        if (action === 'APPROVED') {
          await prisma.employee.update({
            where: { id: request.employeeId },
            data: {
              basicSalary: request.basicSalary,
              allowances: request.allowances
            }
          });
        }
      } else if (entityType === 'Goal') {
        const request = await prisma.goal.findUnique({ where: { id: entityId }, include: { employee: true } });
        if (!request) throw new Error("Goal not found");
        if (request.employee.managerId !== user.employeeId && user.role !== 'SUPER_ADMIN') {
          throw new Error("Only the direct manager can approve this goal");
        }
        previousStatus = request.status;
        
        await prisma.goal.update({
          where: { id: entityId },
          data: { 
            status: action === 'APPROVED' ? 'approved' : 'draft', 
            approvedBy: user.id 
          }
        });
      } else if (entityType === 'Document') {
        if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
          throw new Error("Not authorized to approve Document");
        }
        const request = await prisma.document.findUnique({ where: { id: entityId } });
        if (!request) throw new Error("Document not found");
        previousStatus = request.status;
        
        await prisma.document.update({
          where: { id: entityId },
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
      
      await createAuditLog({ prisma, ipAddress, 
        actorId: user.id, 
        entityType: 'ApprovalRecord', 
        entityId: approvalRecord.id, 
        action: 'CREATE' 
      });
      
      return approvalRecord;
    },


    // Phase 2 Mutations
    createLeaveType: async (_, { name, daysPerYear, isPaid = true, requiresApproval = true }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.leaveType.create({
        data: { name, daysPerYear, isPaid, requiresApproval, organizationId: user.organizationId }
      });
    },
    submitLeaveRequest: async (_, { input }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      if (!user.employeeId) throw new Error("User is not an employee");
      
      const employee = await prisma.employee.findUnique({ 
        where: { id: user.employeeId },
        include: { manager: { include: { user: true } }, organization: true }
      });

      const leaveType = await prisma.leaveType.findUnique({
        where: { id: input.leaveTypeId }
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

      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          employeeId: user.employeeId,
          leaveTypeId: input.leaveTypeId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          totalDays: input.totalDays,
          reason: input.reason,
          attachmentUrl: input.attachmentUrl
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
    approveLeaveRequest: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: { include: { user: true } } } });
      
      let nextStatus = 'APPROVED';
      if (user.role === 'MANAGER' && leave.status === 'PENDING') {
        nextStatus = 'PENDING_HR';
      }
      
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: nextStatus }
      });
      await recordApprovalEvent({ entityType: 'LeaveRequest', entityId: id, approverUserId: user.id, action: nextStatus, previousStatus: leave.status });
      
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
    rejectLeaveRequest: async (_, { id, reason }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const leave = await prisma.leaveRequest.findUnique({ where: { id } });
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: 'REJECTED' }
      });
      await recordApprovalEvent({ entityType: 'LeaveRequest', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: leave.status });
      return updated;
    },
    submitLeavePlan: async (_, { year, plannedDates }, { prisma, user, requireAuth }) => {
      requireAuth();
      const employee = await prisma.employee.findUnique({ where: { email: user.email } });
      if (!employee) throw new Error("Employee not found");
      
      return prisma.leavePlan.upsert({
        where: { employeeId_year: { employeeId: employee.id, year } },
        update: { plannedDates, status: 'PENDING' },
        create: { employeeId: employee.id, year, plannedDates, status: 'PENDING' }
      });
    },
    approveLeavePlan: async (_, { planId }, { prisma, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      return prisma.leavePlan.update({
        where: { id: planId },
        data: { status: 'APPROVED' }
      });
    },
    rejectLeavePlan: async (_, { planId }, { prisma, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      return prisma.leavePlan.update({
        where: { id: planId },
        data: { status: 'REJECTED' }
      });
    },
    clockIn: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      if (!user.employeeId) throw new Error("User is not an employee");
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      return prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: user.employeeId, date: today } },
        update: { clockIn: new Date() },
        create: { employeeId: user.employeeId, date: today, clockIn: new Date() }
      });
    },
    clockOut: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      if (!user.employeeId) throw new Error("User is not an employee");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return prisma.attendance.update({
        where: { employeeId_date: { employeeId: user.employeeId, date: today } },
        data: { clockOut: new Date() }
      });
    },
    uploadDocument: async (_, args, { prisma, user, requireAuth }) => {
      requireAuth();
      const { employeeId, name, category, fileUrl, fileType, fileSize, visibilityLevel } = args;
      
      let status = 'PENDING';
      if (['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
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
        actorId: user.id,
        entityType: 'Document',
        entityId: document.id,
        action: 'CREATE'
      });
      
      await checkAndPromoteEmployee(employeeId, prisma);
      
      return document;
    },
    replaceDocumentVersion: async (_, { id, fileUrl, fileType, fileSize }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      const document = await prisma.document.findUnique({ where: { id } });
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
      
      const newStatus = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) ? 'ACTIVE' : 'PENDING';
      
      const updatedDocument = await prisma.document.update({
        where: { id },
        data: {
          fileUrl,
          fileType,
          fileSize,
          currentVersion: document.currentVersion + 1,
          status: newStatus,
          uploadedBy: user.id
        }
      });
      
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Document', entityId: id, action: 'UPDATE', previousValue: existing, newValue: updatedEmp, ipAddress });
      
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
    archiveDocument: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const document = await prisma.document.update({
        where: { id },
        data: { status: 'ARCHIVED' }
      });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Document', entityId: id, action: 'UPDATE', previousValue: existing, newValue: updatedEmp, ipAddress });
      return document;
    },
    deleteDocument: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const document = await prisma.document.update({
        where: { id },
        data: { status: 'DELETED' }
      });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Document', entityId: id, action: 'DELETE', previousValue: empToDelete, ipAddress });
      return document;
    },
    approveDocument: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const document = await prisma.document.findUnique({ where: { id } });
      const updatedDocument = await prisma.document.update({
        where: { id },
        data: { status: 'ACTIVE' }
      });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Document', entityId: id, action: 'APPROVE' });
      await recordApprovalEvent({ entityType: 'Document', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: document.status });
      return updatedDocument;
    },
    rejectDocument: async (_, { id, reason }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const document = await prisma.document.findUnique({ where: { id } });
      const updatedDocument = await prisma.document.update({
        where: { id },
        data: { status: 'REJECTED' }
      });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'Document', entityId: id, action: 'REJECT' });
      await recordApprovalEvent({ entityType: 'Document', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: document.status });
      
      if (reason) {
        await prisma.notification.create({
          data: {
            userId: document.employeeId,
            title: 'Document Rejected',
            message: `Your document "${document.name}" was rejected. Reason: ${reason}`,
            category: 'ONBOARDING'
          }
        });
      }
      return document;
    },
    approveProfileUpdateRequest: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const request = await prisma.profileUpdateRequest.findUnique({ where: { id } });
      const updatedRequest = await prisma.profileUpdateRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedBy: user.id }
      });
      const updateData = {};
      updateData[request.fieldName] = request.requestedValue;
      await prisma.employee.update({
        where: { id: request.employeeId },
        data: updateData
      });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'ProfileUpdateRequest', entityId: id, action: 'APPROVE' });
      await recordApprovalEvent({ entityType: 'ProfileUpdateRequest', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: request.status });
      return updatedRequest;
    },
    rejectProfileUpdateRequest: async (_, { id, reason }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const request = await prisma.profileUpdateRequest.findUnique({ where: { id } });
      const updatedRequest = await prisma.profileUpdateRequest.update({
        where: { id },
        data: { status: 'REJECTED', reviewedBy: user.id }
      });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'ProfileUpdateRequest', entityId: id, action: 'REJECT' });
      await recordApprovalEvent({ entityType: 'ProfileUpdateRequest', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: request.status });
      return updatedRequest;
    },

    markNotificationRead: async (_, { id }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      return prisma.notification.update({
        where: { id, userId: user.id },
        data: { isRead: true }
      });
    },

    // Phase 3 Mutations
    requestCompensationUpdate: async (_, { employeeId, basicSalary, allowances, reason }, { prisma, user, requireRole, ipAddress }) => {
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
      
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'SalaryHistory', entityId: record.id, action: 'CREATED', previousValue: { basicSalary: employee.basicSalary, allowances: employee.allowances }, newValue: record, ipAddress });
      return record;
    },

    createPayrollRun: async (_, { month, periodStart, periodEnd }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
      
      const employees = await prisma.employee.findMany({
        where: { organizationId: user.organizationId, employmentStatus: 'ACTIVE' }
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
          totalAllowances += (parseFloat(val) || 0);
        });
        
        const grossPay = basicSalary + totalAllowances;
        
        // Nigerian PAYE Calculation
        // 1. Annualize
        const annualGross = grossPay * 12;
        
        // 2. Compute Pension (8% of gross)
        const annualPension = annualGross * 0.08;
        
        // 3. Consolidated Relief Allowance (CRA)
        const cra = Math.max(200000, annualGross * 0.01) + (annualGross * 0.20);
        
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
          deductions: { tax: monthlyTax, pension: monthlyPension },
          totalDeductions,
          netPay,
        };
      });

      await prisma.payrollRecord.createMany({ data: records });

      return prisma.payrollRun.update({
        where: { id: payrollRun.id },
        data: { totalGross, totalNet }
      });
    },

    submitPayrollRun: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const pr = await prisma.payrollRun.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'PENDING_APPROVAL' }
      });
      await recordApprovalEvent({ entityType: 'PayrollRun', entityId: id, approverUserId: user.id, action: 'PENDING_APPROVAL', previousStatus: pr.status });
      return updated;
    },
    approvePayrollRun: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'FINANCE_ADMIN']);
      const pr = await prisma.payrollRun.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'APPROVED', approvedBy: user.id }
      });
      await createAuditLog({ prisma, ipAddress, actorId: user.id, entityType: 'PayrollRun', entityId: id, action: 'APPROVED', previousValue: policy, newValue: updated, ipAddress });
      await recordApprovalEvent({ entityType: 'PayrollRun', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: pr.status });
      return updated;
    },
    rejectPayrollRun: async (_, { id, reason }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'FINANCE_ADMIN']);
      const pr = await prisma.payrollRun.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'REJECTED' }
      });
      await recordApprovalEvent({ entityType: 'PayrollRun', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: pr.status });
      return updated;
    },

    generatePayslip: async (_, { recordId }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      // To implement a real PDF generation async worker:
      // 1. Push a job to BullMQ queue: `pdfQueue.add('generatePayslip', { recordId })`.
      // 2. The worker would fetch the PayrollRecord and render a Handlebars HTML template.
      // 3. The worker would launch Puppeteer, call `page.pdf()`, and upload the buffer to AWS S3.
      // 4. Update the PayrollRecord.payslipUrl with the S3 link.
      
      // For this MVP, we simulate it by returning a mock URL pointing to an HTML view or mock PDF.
      const mockPdfUrl = `/api/payslip/preview/${recordId}`;
      await prisma.payrollRecord.update({
        where: { id: recordId },
        data: { payslipUrl: mockPdfUrl }
      });
      return mockPdfUrl;
    },

    // Phase 4 Mutations
    createPolicy: async (_, { title, category, content, requiresAck }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.policy.create({
        data: { title, category, content, requiresAck, organizationId: user.organizationId, createdBy: user.id, status: 'DRAFT' }
      });
    },
    submitPolicy: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const pol = await prisma.policy.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.policy.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'PENDING' }
      });
      await recordApprovalEvent({ entityType: 'Policy', entityId: id, approverUserId: user.id, action: 'PENDING', previousStatus: pol.status });
      return updated;
    },
    approvePolicy: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN']);
      const pol = await prisma.policy.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.policy.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'APPROVED' }
      });
      await recordApprovalEvent({ entityType: 'Policy', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: pol.status });
      return updated;
    },
    rejectPolicy: async (_, { id, reason }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN']);
      const pol = await prisma.policy.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.policy.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'REJECTED' }
      });
      await recordApprovalEvent({ entityType: 'Policy', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: pol.status });
      return updated;
    },
    acknowledgePolicy: async (_, { policyId }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      await prisma.policyAcknowledgment.upsert({
        where: { policyId_userId: { policyId, userId: user.id } },
        update: {},
        create: { policyId, userId: user.id }
      });
      return true;
    },
    createAnnouncement: async (_, { title, content, priority }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.announcement.create({
        data: { title, content, priority, organizationId: user.organizationId, createdBy: user.id }
      });
    },
    createGoal: async (_, { employeeId, title, weight, period }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      return prisma.goal.create({
        data: { employeeId, title, weight, period }
      });
    },

    // Phase 5 & 6 Mutations
    createCheckIn: async (_, { employeeId, period, scheduledDate }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      return prisma.checkIn.create({
        data: { employeeId, managerId: user.employeeId, period, scheduledDate: scheduledDate ? new Date(scheduledDate) : null }
      });
    },
    updateCheckIn: async (_, { id, selfAppraisal, managerNotes, overallRating, status }, { prisma, requireAuth }) => {
      requireAuth();
      const data = {};
      if (selfAppraisal !== undefined) data.selfAppraisal = selfAppraisal;
      if (managerNotes !== undefined) data.managerNotes = managerNotes;
      if (overallRating !== undefined) data.overallRating = overallRating;
      if (status !== undefined) {
        data.status = status;
        if (status === 'completed') data.completedDate = new Date();
      }
      return prisma.checkIn.update({ where: { id }, data });
    },
    createOnboardingTask: async (_, { employeeId, title, description, category, assignedTo, dueDate }, { prisma, requireAuth }) => {
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
    updateOnboardingTask: async (_, { id, status, isCompleted }, { prisma, requireAuth }) => {
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
      return prisma.onboardingTask.update({ where: { id }, data });
    },
    initiateOffboarding: async (_, { employeeId, exitType, exitDate, reason }, { prisma, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      // Also update employee status
      await prisma.employee.update({
        where: { id: employeeId },
        data: { employmentStatus: 'OFFBOARDED' } // could be RESIGNED or TERMINATED based on exitType but sticking to OFFBOARDED
      });
      return prisma.offboarding.upsert({
        where: { employeeId },
        update: { exitType, exitDate: new Date(exitDate), reason },
        create: { employeeId, exitType, exitDate: new Date(exitDate), reason }
      });
    },
    updateOffboarding: async (_, { id, assetReturned, accessRevoked, handoverComplete }, { prisma, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const data = {};
      if (assetReturned !== undefined) data.assetReturned = assetReturned;
      if (accessRevoked !== undefined) data.accessRevoked = accessRevoked;
        if (handoverComplete !== undefined) data.handoverComplete = handoverComplete;
      return prisma.offboarding.update({ where: { id }, data });
    }
  },
  Notification: {
    isRead: (parent) => parent.isRead || false
  },
  AuditLog: {
    previousValue: (parent) => parent.previousValue ? JSON.stringify(parent.previousValue) : null,
    newValue: (parent) => parent.newValue ? JSON.stringify(parent.newValue) : null,
  },
  ApprovalWorkflow: {
    steps: (parent) => parent.steps ? JSON.stringify(parent.steps) : '[]',
  },
  Employee: {
    department: async (parent, _, { prisma }) => {
      if (!parent.departmentId) return null;
      return prisma.department.findUnique({ where: { id: parent.departmentId } });
    },
    manager: async (parent, _, { prisma }) => {
      if (!parent.managerId) return null;
      return prisma.employee.findUnique({ where: { id: parent.managerId } });
    },
    basicSalary: (parent, _, { user }) => {
      return (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id) ? parent.basicSalary : null;
    },
    allowances: (parent, _, { user }) => {
      return (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id) ? parent.allowances : null;
    },
    bankName: (parent, _, { user }) => {
      return (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id) ? parent.bankName : null;
    },
    bankAccountNumber: (parent, _, { user }) => {
      return (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id) ? parent.bankAccountNumber : null;
    },
    pensionId: (parent, _, { user }) => {
      return (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id) ? parent.pensionId : null;
    },
    nationalId: (parent, _, { user }) => {
      return (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id) ? parent.nationalId : null;
    },
    passportNumber: (parent, _, { user }) => {
      return (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.employeeId === parent.id) ? parent.passportNumber : null;
    }
  },
  Department: {
    
    loans: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      const where = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role) 
        ? {} 
        : { employeeId: user.employeeId };
        
      const loans = await prisma.loan.findMany({
        where,
        include: { employee: true }
      });
      
      return loans.map(l => ({
        ...l,
        employee_id: l.employeeId,
        employee_name: l.employee?.fullName,
        loan_type: 'standard', // For backward compat with UI
        loan_amount: l.amount,
        duration_months: Math.ceil(l.amount / l.monthlyRepayment),
        monthly_installment: l.monthlyRepayment,
        start_month: l.startDate.toISOString().slice(0, 7)
      }));
    },
    employees: async (parent, _, { prisma }) => {
      const emps = await prisma.employee.findMany({ where: { departmentId: parent.id } });
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
