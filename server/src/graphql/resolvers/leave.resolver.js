import { NotificationService } from '../../services/NotificationService.js';
import { recordApprovalEvent } from '../../utils/audit.js';
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
      const where = employeeId ? {
        employeeId,
        employee: { organizationId: user.organizationId }
      } : {
        employee: { organizationId: user.organizationId }
      };
      return prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { employee: true, leaveType: true }
      });
    },
    paginatedLeaveRequests: async (_, { page = 1, limit = 10, employeeId }, { prisma, user, requireAuth }) => {
      requireAuth();
      const skip = (page - 1) * limit;
      const where = employeeId ? {
        employeeId,
        employee: { organizationId: user.organizationId }
      } : {
        employee: { organizationId: user.organizationId }
      };
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
    teamLeavePlans: async (_, { year }, { prisma, user, requireAuth }) => {
      requireAuth();
      if (['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        return prisma.leavePlan.findMany({
          where: { year }, include: { employee: true }
        });
      }
      const employee = await prisma.employee.findUnique({ where: { email: user.email } });
      if (!employee) return [];
      return prisma.leavePlan.findMany({
        where: { year, employee: { managerId: employee.id } }, include: { employee: true }
      });
    },
    leaveBalances: async (_, { employeeId }, { prisma, requireAuth }) => {
      requireAuth();
      const currentYear = new Date().getFullYear();
      return prisma.leaveBalance.findMany({
        where: { employeeId, year: currentYear },
        include: { leaveType: true }
      });
    },
    leaveCalendar: async (_, { month, departmentId }, { prisma, user, requireAuth }) => {
      requireAuth();
      const whereClause = {
        status: 'APPROVED',
        employee: { organizationId: user.organizationId }
      };
      if (departmentId) {
        whereClause.employee.departmentId = departmentId;
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
    submitLeaveRequest: async (_, { input }, { prisma, user, requireAuth }) => {
      requireAuth();
      const employee = await prisma.employee.findUnique({ where: { email: user.email } });
      if (!employee) throw new Error("Employee record not found for this user");

      const publicHolidays = await prisma.publicHoliday.findMany({
        where: { organizationId: user.organizationId, date: { gte: new Date(input.startDate), lte: new Date(input.endDate) } }
      });

      const businessDays = calculateBusinessDays(new Date(input.startDate), new Date(input.endDate), publicHolidays.map(h => h.date));
      if (businessDays === 0) throw new Error("Requested period contains zero business days.");

      const balanceCheck = await validateLeaveBalance(employee.id, input.leaveTypeId, businessDays, prisma);
      if (!balanceCheck.isValid) throw new Error(balanceCheck.reason);

      // Deduct available -> pending
      await prisma.leaveBalance.update({
        where: { id: balanceCheck.balance.id },
        data: {
          available: { decrement: businessDays },
          pending: { increment: businessDays }
        }
      });

      return prisma.leaveRequest.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: input.leaveTypeId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          reason: input.reason,
          handoverNote: input.handoverNote,
          attachmentUrl: input.attachmentUrl,
          status: 'PENDING'
        }
      });
    },
    approveLeaveRequest: async (_, { id }, { prisma, user, requireRole }) => {
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
      return updated;
    },
    rejectLeaveRequest: async (_, { id, reason }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const leave = await prisma.leaveRequest.findUnique({ where: { id }, include: { employee: true } });
      
      const currentYear = new Date().getFullYear();
      const publicHolidays = await prisma.publicHoliday.findMany({
        where: { organizationId: leave.employee.organizationId, date: { gte: leave.startDate, lte: leave.endDate } }
      });
      const businessDays = calculateBusinessDays(leave.startDate, leave.endDate, publicHolidays.map(h => h.date));

      // Restore pending -> available
      if (leave.status === 'PENDING' || leave.status === 'PENDING_HR') {
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
      return updated;
    },
    cancelLeaveRequest: async (_, { id, reason }, { prisma, user, requireAuth }) => {
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

      return prisma.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancellationReason: reason, cancelledAt: new Date(), cancelledById: user.id }
      });
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
