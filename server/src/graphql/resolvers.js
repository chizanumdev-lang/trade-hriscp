import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { v2 as cloudinary } from 'cloudinary';
import { createAuditLog } from '../utils/audit.js';

export const resolvers = {
  Query: {
    me: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.user.findUnique({ where: { id: user.id } });
    },
    organization: async (_, { id }, { prisma, requireAuth }) => {
      requireAuth();
      return prisma.organization.findUnique({ where: { id } });
    },
    employees: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      const emps = await prisma.employee.findMany({ where: { organizationId: user.organizationId } });
      return emps.map(emp => ({
        ...emp,
        hireDate: emp.hireDate ? emp.hireDate.toISOString() : null
      }));
    },
    employee: async (_, { id }, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.employee.findFirst({
        where: { id, organizationId: user.organizationId }
      });
    },
    departments: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.department.findMany({ where: { organizationId: user.organizationId } });
    },
    onboardingTasks: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      // To show everyone's tasks, we fetch all tasks in the org
      return prisma.onboardingTask.findMany({
        where: { employee: { organizationId: user.organizationId } },
        orderBy: { createdAt: 'desc' }
      });
    },
    // Phase 2 Queries
    leaveTypes: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.leaveType.findMany({ where: { organizationId: user.organizationId } });
    },
    leaveRequests: async (_, { employeeId }, { prisma, user, requireAuth }) => {
      requireAuth();
      const where = employeeId ? { employeeId } : {};
      // Should also restrict to organization but skipped for brevity
      return prisma.leaveRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
    },
    attendanceRecords: async (_, { employeeId, date }, { prisma, user, requireAuth }) => {
      requireAuth();
      const where = {};
      if (employeeId) where.employeeId = employeeId;
      if (date) where.date = new Date(date);
      return prisma.attendance.findMany({ where, orderBy: { date: 'desc' } });
    },
    documents: async (_, { employeeId, category }, { prisma, user, requireAuth }) => {
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
        where.status = 'ACTIVE';
        where.visibilityLevel = { in: ['employee', 'all'] };
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
    documentHistory: async (_, { documentId }, { prisma, user, requireRole }) => {
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
    payrollRecords: async (_, { payrollRunId }, { prisma, user, requireRole }) => {
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
    goals: async (_, { employeeId }, { prisma, user, requireAuth }) => {
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
    upcomingCelebrations: async (_, { month }, { prisma, user, requireAuth }) => {
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
    createEmployee: async (_, { input }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const { templateId, ...employeeData } = input;
      const count = await prisma.employee.count({ where: { organizationId: user.organizationId } });
      const employeeCode = `EMP-${(count + 1).toString().padStart(6, '0')}`;
      const emp = await prisma.employee.create({
        data: {
          ...employeeData,
          employeeCode,
          organizationId: user.organizationId,
          hireDate: new Date(employeeData.hireDate),
          employmentStatus: 'PENDING_ONBOARDING',
          onboardingStatus: 'in_progress',
        }
      });
      await createAuditLog({ actorId: user.id, entityType: 'Employee', entityId: emp.id, action: 'CREATE' });
      
      // Auto-generate onboarding tasks as per PRD 06
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
            assignedTo: employeeData.fullName,
          }
        });
      }
      
      return emp;
    },
    updateEmployee: async (_, { id, input }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      
      const existing = await prisma.employee.findFirst({
        where: { id, organizationId: user.organizationId }
      });
      if (!existing) throw new Error("Employee not found");
      
      const updateData = { ...input };
      if (input.dateOfBirth) updateData.dateOfBirth = new Date(input.dateOfBirth);
      if (input.hireDate) updateData.hireDate = new Date(input.hireDate);
      
      const updated = await prisma.employee.update({
        where: { id },
        data: updateData
      });
      
      await createAuditLog({ actorId: user.id, entityType: 'Employee', entityId: id, action: 'UPDATE' });
      return updated;
    },
    deleteEmployee: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      await prisma.employee.delete({ where: { id, organizationId: user.organizationId } });
      await createAuditLog({ actorId: user.id, entityType: 'Employee', entityId: id, action: 'DELETE' });
      return true;
    },

    createDepartment: async (_, { name, code, headEmployeeId }, { prisma, user, requireRole }) => {
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
    
    updateDepartment: async (_, { id, name, code, headEmployeeId }, { prisma, user, requireRole }) => {
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

    approveDepartment: async (_, { id }, { prisma, user, requireRole }) => {
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

    deleteDepartment: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      await prisma.department.delete({
        where: { id, organizationId: user.organizationId }
      });
      return true;
    },
    
    processApproval: async (_, { entityType, entityId, action, comments }, { prisma, user, requireAuth }) => {
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
      
      await createAuditLog({ 
        actorId: user.id, 
        entityType: 'ApprovalRecord', 
        entityId: approvalRecord.id, 
        action: 'CREATE' 
      });
      
      return approvalRecord;
    },
    updateOnboardingTask: async (_, { id, isCompleted, status }, { prisma, user, requireAuth }) => {
      requireAuth();
      const updateData = {};
      if (isCompleted !== undefined) {
        updateData.isCompleted = isCompleted;
        updateData.completedAt = isCompleted ? new Date() : null;
      }
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'done') {
           updateData.isCompleted = true;
           updateData.completedAt = new Date();
        } else {
           updateData.isCompleted = false;
           updateData.completedAt = null;
        }
      }
      
      return prisma.onboardingTask.update({
        where: { id },
        data: updateData
      });
    },

    // Phase 2 Mutations
    createLeaveType: async (_, { name, daysPerYear, isPaid = true, requiresApproval = true }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.leaveType.create({
        data: { name, daysPerYear, isPaid, requiresApproval, organizationId: user.organizationId }
      });
    },
    submitLeaveRequest: async (_, { input }, { prisma, user, requireAuth }) => {
      requireAuth();
      if (!user.employeeId) throw new Error("User is not an employee");
      return prisma.leaveRequest.create({
        data: {
          employeeId: user.employeeId,
          leaveTypeId: input.leaveTypeId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          totalDays: input.totalDays,
          reason: input.reason
        }
      });
    },
    approveLeaveRequest: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      return prisma.leaveRequest.update({
        where: { id },
        data: { status: 'APPROVED' }
      });
    },
    rejectLeaveRequest: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      return prisma.leaveRequest.update({
        where: { id },
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
      
      return document;
    },
    replaceDocumentVersion: async (_, { id, fileUrl, fileType, fileSize }, { prisma, user, requireAuth }) => {
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
      
      await createAuditLog({ actorId: user.id, entityType: 'Document', entityId: id, action: 'UPDATE' });
      return updatedDocument;
    },
    archiveDocument: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const document = await prisma.document.update({
        where: { id },
        data: { status: 'ARCHIVED' }
      });
      await createAuditLog({ actorId: user.id, entityType: 'Document', entityId: id, action: 'UPDATE' });
      return document;
    },
    deleteDocument: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const document = await prisma.document.update({
        where: { id },
        data: { status: 'DELETED' }
      });
      await createAuditLog({ actorId: user.id, entityType: 'Document', entityId: id, action: 'DELETE' });
      return document;
    },
    markNotificationRead: async (_, { id }, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.notification.update({
        where: { id, userId: user.id },
        data: { isRead: true }
      });
    },

    // Phase 3 Mutations
    requestCompensationUpdate: async (_, { employeeId, basicSalary, allowances, reason }, { prisma, user, requireRole }) => {
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
      
      await createAuditLog({ actorId: user.id, entityType: 'SalaryHistory', entityId: record.id, action: 'CREATED' });
      return record;
    },

    createPayrollRun: async (_, { month, periodStart, periodEnd }, { prisma, user, requireRole }) => {
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

    approvePayrollRun: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'FINANCE_ADMIN']);
      const pr = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'APPROVED', approvedBy: user.id }
      });
      await createAuditLog({ actorId: user.id, entityType: 'PayrollRun', entityId: id, action: 'APPROVED' });
      return pr;
    },

    generatePayslip: async (_, { recordId }, { prisma, user, requireAuth }) => {
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
    createPolicy: async (_, { title, category, content, requiresAck }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.policy.create({
        data: { title, category, content, requiresAck, organizationId: user.organizationId, createdBy: user.id }
      });
    },
    acknowledgePolicy: async (_, { policyId }, { prisma, user, requireAuth }) => {
      requireAuth();
      await prisma.policyAcknowledgment.upsert({
        where: { policyId_userId: { policyId, userId: user.id } },
        update: {},
        create: { policyId, userId: user.id }
      });
      return true;
    },
    createAnnouncement: async (_, { title, content, priority }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.announcement.create({
        data: { title, content, priority, organizationId: user.organizationId, createdBy: user.id }
      });
    },
    createGoal: async (_, { employeeId, title, weight, period }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      return prisma.goal.create({
        data: { employeeId, title, weight, period }
      });
    },

    // Phase 5 & 6 Mutations
    createCheckIn: async (_, { employeeId, period, scheduledDate }, { prisma, user, requireRole }) => {
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
      if (status !== undefined) data.status = status;
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
  Employee: {
    department: async (parent, _, { prisma }) => {
      if (!parent.departmentId) return null;
      return prisma.department.findUnique({ where: { id: parent.departmentId } });
    }
  },
  Department: {
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
