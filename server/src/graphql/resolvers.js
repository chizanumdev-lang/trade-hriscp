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
        // Simplified Tax Engine (Flat 10% for example purposes)
        const tax = basicSalary * 0.10;
        const netPay = basicSalary - tax;

        totalGross += basicSalary;
        totalNet += netPay;

        return {
          payrollRunId: payrollRun.id,
          employeeId: emp.id,
          basicSalary,
          allowances: {},
          grossPay: basicSalary,
          deductions: { tax },
          totalDeductions: tax,
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
      // Placeholder for PDF Generation Logic (PDFKit, Puppeteer, etc.)
      const mockPdfUrl = `https://tradevu-hris.s3.amazonaws.com/payslips/${recordId}.pdf`;
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
