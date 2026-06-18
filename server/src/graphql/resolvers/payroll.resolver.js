import { NotificationService } from '../../services/NotificationService.js';
import { createAuditLog, recordApprovalEvent } from '../../utils/audit.js';
import { calculatePayslip, generatePaymentBatches } from '../../utils/payrollUtils.js';

export const payrollResolvers = {
  Query: {
    salaryHistory: async (_, { employeeId }, { prisma, requireAuth }) => {
      requireAuth();
      return prisma.salaryHistory.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' }
      });
    },
    payrollRuns: async (_, __, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
      return prisma.payrollRun.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { month: 'desc' }
      });
    },
    payrollRecords: async (_, { payrollRunId }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
      return prisma.payrollRecord.findMany({
        where: {
          payrollRunId,
          employee: { organizationId: user.organizationId }
        },
        include: { employee: true }
      });
    },
    myPayrollRecords: async (_, __, { prisma, user, requireAuth }) => {
      requireAuth();
      const employee = await prisma.employee.findUnique({ where: { email: user.email } });
      if (!employee) return [];
      return prisma.payrollRecord.findMany({
        where: { employeeId: employee.id }
      });
    }
  },
  Mutation: {
    createPayrollRun: async (_, { month, periodStart, periodEnd }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
      
      const employees = await prisma.employee.findMany({
        where: {
          organizationId: user.organizationId,
          employmentStatus: 'ACTIVE'
        },
        include: {
          employeeCompensation: {
            include: { compensationStructure: true }
          },
          payrollAdjustments: {
            where: { status: 'APPROVED' }
          }
        }
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

      const recordsData = [];

      for (const emp of employees) {
        if (!emp.employeeCompensation || !emp.employeeCompensation.compensationStructure) {
          // Fallback if missing structure
          continue;
        }

        const payslip = calculatePayslip(
          emp, 
          emp.employeeCompensation.compensationStructure, 
          { year: parseInt(month.split('-')[0]), month: parseInt(month.split('-')[1]) },
          emp.payrollAdjustments
        );

        const paymentBatches = generatePaymentBatches([payslip]);

        recordsData.push({
          payrollRunId: payrollRun.id,
          employeeId: emp.id,
          basicSalary: payslip.basicSalary,
          allowances: payslip.allowances,
          grossPay: payslip.grossPay,
          deductions: payslip.deductions,
          totalDeductions: payslip.deductions,
          netPay: payslip.netPay,
          paymentBatches
        });

        totalGross += payslip.grossPay;
        totalNet += payslip.netPay;

        // Mark adjustments as PROCESSED
        if (emp.payrollAdjustments.length > 0) {
          await prisma.payrollAdjustment.updateMany({
            where: { id: { in: emp.payrollAdjustments.map(a => a.id) } },
            data: { status: 'PROCESSED', payrollRunId: payrollRun.id }
          });
        }
      }

      if (recordsData.length > 0) {
        await prisma.payrollRecord.createMany({ data: recordsData });
      }

      return prisma.payrollRun.update({
        where: { id: payrollRun.id },
        data: { totalGross, totalNet }
      });
    },
    submitPayrollRun: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['HR_ADMIN', 'SUPER_ADMIN']);
      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'PENDING_APPROVAL' }
      });

      await createAuditLog({
        prisma, ipAddress, userId: user.id, organizationId: user.organizationId, entityType: 'PayrollRun', entityId: id,
        action: 'SUBMITTED', previousValue: { status: 'DRAFT' }, newValue: { status: 'PENDING_APPROVAL' }
      });

      return updated;
    },
    approvePayrollRun: async (_, { id }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'FINANCE_ADMIN']);
      const pr = await prisma.payrollRun.findUnique({ where: { id, organizationId: user.organizationId } });
      if (!pr) throw new Error("Payroll run not found.");

      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'APPROVED', approvedBy: user.id }
      });

      await createAuditLog({
        prisma, ipAddress, userId: user.id, organizationId: user.organizationId, entityType: 'PayrollRun', entityId: id,
        action: 'APPROVED', previousValue: { status: pr.status }, newValue: { status: 'APPROVED' }
      });

      await recordApprovalEvent({
        entityType: 'PayrollRun', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: pr.status
      });

      // Create PaymentBatches in the DB
      const records = await prisma.payrollRecord.findMany({ where: { payrollRunId: id } });
      const batch1Records = [];
      const batch2Records = [];
      
      for (const rec of records) {
        if (rec.paymentBatches) {
          const batches = rec.paymentBatches;
          batch1Records.push(...batches.find(b => b.batchLabel === 'FIRST').records);
          batch2Records.push(...batches.find(b => b.batchLabel === 'SECOND').records);
        }
        
        // Generate actual Payslip DB record
        await prisma.payslip.create({
          data: {
            employeeId: rec.employeeId,
            payrollRunId: id,
            issuedAt: new Date()
          }
        });
      }

      await prisma.paymentBatch.createMany({
        data: [
          { payrollRunId: id, batchLabel: 'FIRST', percentage: 60, records: batch1Records },
          { payrollRunId: id, batchLabel: 'SECOND', percentage: 40, records: batch2Records }
        ]
      });

      // After generation, update payroll run to PAYMENT_GENERATED
      return prisma.payrollRun.update({
        where: { id },
        data: { status: 'PAYMENT_GENERATED' }
      });
    },
    rejectPayrollRun: async (_, { id, reason }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'FINANCE_ADMIN']);
      const pr = await prisma.payrollRun.findUnique({ where: { id, organizationId: user.organizationId } });
      
      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'REJECTED' }
      });

      await createAuditLog({
        prisma, ipAddress, userId: user.id, organizationId: user.organizationId, entityType: 'PayrollRun', entityId: id,
        action: 'REJECTED', previousValue: { status: pr.status }, newValue: { status: 'REJECTED' }
      });

      return updated;
    },
    generatePayslip: async (_, { recordId }, { prisma, requireAuth }) => {
      requireAuth();
      // Placeholder for actual PDF generation
      return `https://storage.tradevu.com/payslips/${recordId}.pdf`;
    }
  }
};
