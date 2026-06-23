import { NotificationService } from '../../services/NotificationService.js';
import { recordApprovalEvent, createAuditLog } from '../../utils/audit.js';
import { calculateBusinessDays, validateLeaveBalance } from '../../utils/leaveUtils.js';

export const leaveResolvers = {
  Query: {
    leaveTypes: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.leaveType.findMany({
        where: { organizationId: user.organizationId }
      });
    },
    leaveRequests: async (_, { employeeId }, { prisma, user, requireAuth }) => {
      requireAuth();
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);
      const isManager = user.role === 'MANAGER';
      
      let where = { employee: { organizationId: user.organizationId } };
      
      if (!isAdmin && !isManager) {
        where.employeeId = user.employeeId;
      } else if (isManager && !employeeId) {
        // Manager fetching their own and team's leaves
        const manager = await prisma.employee.findUnique({ where: { id: user.employeeId } });
        if (manager && manager.departmentId) {
          // Find all employees in the same department
          where.employee = { 
            departmentId: manager.departmentId, 
            organizationId: user.organizationId 
          };
        } else {
          where.employeeId = user.employeeId;
        }
      } else if (employeeId) {
        where.employeeId = employeeId;
      }

      return prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { employee: true, leaveType: true }
      });
    },
    paginatedLeaveRequests: async (_, { page = 1, limit = 10, employeeId }, { prisma, user, requireAuth }) => {
      requireAuth();
      const skip = (page - 1) * limit;
      
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);
      const isManager = user.role === 'MANAGER';
      
      let where = { employee: { organizationId: user.organizationId } };
      
      if (!isAdmin && !isManager) {
        where.employeeId = user.employeeId;
      } else if (isManager && !employeeId) {
        const manager = await prisma.employee.findUnique({ where: { id: user.employeeId } });
        if (manager && manager.departmentId) {
          where.employee = { 
            departmentId: manager.departmentId, 
            organizationId: user.organizationId 
          };
        } else {
          where.employeeId = user.employeeId;
        }
      } else if (employeeId) {
        where.employeeId = employeeId;
      }

      const [leaveRequests, totalCount] = await Promise.all([
        prisma.leaveRequest.findMany({
          where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { employee: true, leaveType: true }
        }),
        prisma.leaveRequest.count({ where })
      ]);
      return {
        leaveRequests, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: page
      };
    },
    myLeavePlans: async (_, { year }, { prisma, user, requireAuth }) => {
      requireAuth();
      const employee = await prisma.employee.findUnique({ where: { email: user.email } });
      if (!employee) throw new Error("Employee record not found for this user");
      return prisma.leavePlan.findMany({
        where: { employeeId: employee.id, year }, include: { employee: true }
      });
    },
    teamLeavePlans: async (_, { year, departmentId }, { prisma, user, requireAuth }) => {
      requireAuth();
      const isAdmin = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role);
      const isManager = user.role === 'MANAGER';
      let whereClause = { year };

      if (isAdmin) {
        if (departmentId) {
          whereClause.employee = { departmentId };
        }
        return prisma.leavePlan.findMany({
          where: whereClause, include: { employee: true }
        });
      }

      if (isManager) {
        const employee = await prisma.employee.findUnique({ where: { email: user.email } });
        if (!employee) return [];
        if (employee.departmentId) {
          whereClause.employee = { departmentId: employee.departmentId };
        } else {
          whereClause.employeeId = employee.id; // Fallback
        }
        return prisma.leavePlan.findMany({
          where: whereClause, include: { employee: true }
        });
      }

      // Normal employees only see their own
      const employee = await prisma.employee.findUnique({ where: { email: user.email } });
      if (!employee) return [];
      whereClause.employeeId = employee.id;
      return prisma.leavePlan.findMany({
        where: whereClause, include: { employee: true }
      });
    },
    leaveBalances: async (_, { employeeId }, { prisma, requireAuth }) => {
      requireAuth();
      const currentYear = new Date().getFullYear();
      let balances = await prisma.leaveBalance.findMany({
        where: { employeeId, year: currentYear },
        include: { leaveType: true }
      });

      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (employee) {
        const leaveTypes = await prisma.leaveType.findMany({
          where: { organizationId: employee.organizationId }
        });
        
        const existingTypeIds = balances.map(b => b.leaveTypeId);
        const missingTypes = leaveTypes.filter(t => !existingTypeIds.includes(t.id));
        
        if (missingTypes.length > 0) {
          for (const type of missingTypes) {
            await prisma.leaveBalance.create({
              data: {
                employeeId,
                leaveTypeId: type.id,
                year: currentYear,
                totalEntitled: type.daysPerYear,
                used: 0,
                pending: 0,
                available: type.daysPerYear,
                carriedForward: 0,
                expired: 0
              }
            });
          }
          
          balances = await prisma.leaveBalance.findMany({
            where: { employeeId, year: currentYear },
            include: { leaveType: true }
          });
        }
      }

      return balances;
    },
    leaveCalendar: async (_, { year, departmentId }, { prisma, user, requireAuth }) => {
      requireAuth();
      
      const yearStart = new Date(`${year}-01-01`);
      const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);
      
      const whereClause = {
        status: 'APPROVED',
        employee: { organizationId: user.organizationId },
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart }
      };
      
      const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role);
      const isManager = user.role === 'MANAGER';
      
      if (isAdmin) {
        if (departmentId) {
          whereClause.employee.departmentId = departmentId;
        }
      } else if (isManager) {
        // Managers see their department's leave
        const emp = await prisma.employee.findUnique({ where: { id: user.employeeId } });
        if (emp?.departmentId) {
          whereClause.employee.departmentId = emp.departmentId;
        } else {
          whereClause.employeeId = user.employeeId;
        }
      } else {
        // Regular employees only see their own leave
        whereClause.employeeId = user.employeeId;
      }
      
      return prisma.leaveRequest.findMany({
        where: whereClause,
        include: { employee: true, leaveType: true }
      });
    },
    publicHolidays: async (_, { year }, { prisma, user, requireAuth }) => {
      requireAuth();
      return prisma.publicHoliday.findMany({
        where: {
          organizationId: user.organizationId,
          date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) }
        },
        orderBy: { date: 'asc' }
      });
    }
  },
  Mutation: {
    createLeaveType: async (_, { name, daysPerYear, isPaid = true, requiresApproval = true, eligibleAfterDays = 0, applicableTo }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.leaveType.create({
        data: {
          name, daysPerYear, isPaid, requiresApproval, eligibleAfterDays, applicableTo, organizationId: user.organizationId
        }
      });
    },
    submitLeaveRequest: async () => {
      throw new Error("This resolver is implemented in misc.resolver.js");
    },
    approveLeaveRequest: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: { include: { user: true } }, leaveType: true }
      });

      let nextStatus = 'APPROVED';
      if (user.role === 'MANAGER' && leave.status === 'PENDING') {
        nextStatus = 'PENDING_HR'; // Needs HR approval
      }

      const currentYear = new Date().getFullYear();
      if (nextStatus === 'APPROVED') {
        const publicHolidays = await prisma.publicHoliday.findMany({
          where: { organizationId: leave.employee.organizationId, date: { gte: leave.startDate, lte: leave.endDate } }
        });
        const businessDays = calculateBusinessDays(leave.startDate, leave.endDate, publicHolidays.map(h => h.date));

        // Deduct pending -> used
        await prisma.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: currentYear } },
          data: {
            pending: { decrement: businessDays },
            used: { increment: businessDays }
          }
        });
      }

      const updated = await prisma.leaveRequest.update({ where: { id }, data: { status: nextStatus } });
      await recordApprovalEvent({ entityType: 'LeaveRequest', entityId: id, approverUserId: user.id, action: nextStatus, previousStatus: leave.status });

      await createAuditLog({
        userId: user.id,
        organizationId: user.organizationId,
        entityType: 'LeaveRequest',
        entityId: id,
        action: nextStatus,
        previousValue: JSON.stringify({ status: leave.status }),
        newValue: JSON.stringify({ status: nextStatus }),
        ipAddress
      });

      return updated;
    },
    rejectLeaveRequest: async (_, { id, reason }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
      
      const currentYear = new Date().getFullYear();
      const publicHolidays = await prisma.publicHoliday.findMany({
        where: { organizationId: leave.employee.organizationId, date: { gte: leave.startDate, lte: leave.endDate } }
      });
      const businessDays = calculateBusinessDays(leave.startDate, leave.endDate, publicHolidays.map(h => h.date));

      // Restore pending or used -> available
      if (leave.status === 'APPROVED') {
        await prisma.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: currentYear } },
          data: {
            used: { decrement: businessDays },
            available: { increment: businessDays }
          }
        });
      } else if (leave.status === 'PENDING' || leave.status === 'PENDING_HR') {
        await prisma.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: currentYear } },
          data: {
            pending: { decrement: businessDays },
            available: { increment: businessDays }
          }
        });
      }

      const updated = await prisma.leaveRequest.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason } });
      await recordApprovalEvent({ entityType: 'LeaveRequest', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: leave.status });

      await createAuditLog({
        userId: user.id,
        organizationId: user.organizationId,
        entityType: 'LeaveRequest',
        entityId: id,
        action: 'REJECTED',
        previousValue: JSON.stringify({ status: leave.status }),
        newValue: JSON.stringify({ status: 'REJECTED', reason }),
        ipAddress
      });

      return updated;
    },
    cancelLeaveRequest: async (_, { id, reason }, { prisma, user, requireAuth, ipAddress }) => {
      requireAuth();
      const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
      
      const currentYear = new Date().getFullYear();
      const publicHolidays = await prisma.publicHoliday.findMany({
        where: { organizationId: leave.employee.organizationId, date: { gte: leave.startDate, lte: leave.endDate } }
      });
      const businessDays = calculateBusinessDays(leave.startDate, leave.endDate, publicHolidays.map(h => h.date));

      // Revert balances depending on current status
      if (leave.status === 'APPROVED') {
        await prisma.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: currentYear } },
          data: { used: { decrement: businessDays }, available: { increment: businessDays } }
        });
      } else if (leave.status === 'PENDING' || leave.status === 'PENDING_HR') {
        await prisma.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: currentYear } },
          data: { pending: { decrement: businessDays }, available: { increment: businessDays } }
        });
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancellationReason: reason, cancelledAt: new Date(), cancelledById: user.id }
      });

      await createAuditLog({
        userId: user.id,
        organizationId: user.organizationId,
        entityType: 'LeaveRequest',
        entityId: id,
        action: 'CANCELLED',
        previousValue: JSON.stringify({ status: leave.status }),
        newValue: JSON.stringify({ status: 'CANCELLED', reason })
      });

      return updated;
    },
    createPublicHoliday: async (_, { input }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.publicHoliday.create({
        data: {
          name: input.name,
          date: new Date(input.date),
          isRecurring: input.isRecurring || false,
          organizationId: user.organizationId
        }
      });
    },
    deletePublicHoliday: async (_, { id }, { prisma, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const deleted = await prisma.publicHoliday.delete({ where: { id } });
      return !!deleted;
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
      return prisma.leavePlan.update({ where: { id: planId }, data: { status: 'APPROVED' } });
    },
    rejectLeavePlan: async (_, { planId }, { prisma, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      return prisma.leavePlan.update({ where: { id: planId }, data: { status: 'REJECTED' } });
    }
  }
};
