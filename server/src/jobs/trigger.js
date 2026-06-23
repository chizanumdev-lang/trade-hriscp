import { TriggerClient, eventTrigger, cronTrigger } from '@trigger.dev/sdk';
import { Resend } from 'resend';
import { prisma } from '../db.js';
import dotenv from 'dotenv';
dotenv.config();

export const client = new TriggerClient({
  id: 'base44-hr',
  apiKey: process.env.TRIGGER_API_KEY,
  apiUrl: process.env.TRIGGER_API_URL,
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Job 1: Send email when a new document is uploaded
client.defineJob({
  id: 'document-uploaded-email',
  name: 'Document Uploaded Notification',
  version: '1.0.0',
  trigger: eventTrigger({
    name: 'document.uploaded',
  }),
  run: async (payload, io, ctx) => {
    await io.logger.info(`Processing document upload for employee ID: ${payload.employeeId}`);
    
    const adminEmail = 'hr-admin@example.com'; 
    
    if (resend) {
      await io.runTask('send-email', async () => {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: adminEmail,
          subject: 'New Employee Document Uploaded',
          html: `<p>A new document (<strong>${payload.documentName}</strong>) has been uploaded and requires review.</p>`,
        });
      });
      await io.logger.info('Notification email sent via Resend!');
    } else {
      await io.logger.info(`[MOCK EMAIL] To: ${adminEmail} | Subject: New Employee Document Uploaded`);
    }
    
    return { status: 'success', documentId: payload.documentId };
  },
});

// Job 2: Daily task to check for pending approvals
client.defineJob({
  id: 'check-pending-approvals-daily',
  name: 'Daily Pending Approvals Check',
  version: '1.0.0',
  trigger: cronTrigger({
    cron: "0 9 * * *", // Runs every day at 9:00 AM
  }),
  run: async (payload, io, ctx) => {
    await io.logger.info('Starting daily check for pending document approvals...');
    
    // Find documents that are uploaded but not yet approved
    const pendingDocuments = await io.runTask('fetch-pending-docs', async () => {
      return prisma.document.findMany({
        where: { status: 'PENDING' },
        include: { employee: true }
      });
    });

    if (pendingDocuments.length === 0) {
      await io.logger.info('No pending documents found. All caught up!');
      return { status: 'success', count: 0 };
    }

    await io.logger.info(`Found ${pendingDocuments.length} pending documents.`);

    if (resend) {
      await io.runTask('send-daily-digest', async () => {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: 'hr-admin@example.com',
          subject: `Action Required: ${pendingDocuments.length} Pending Document Approvals`,
          html: `<p>There are ${pendingDocuments.length} documents awaiting your review.</p>`,
        });
      });
    } else {
      await io.logger.info(`[MOCK EMAIL] To: hr-admin@example.com | Subject: Action Required: ${pendingDocuments.length} Pending Document Approvals`);
    }

    return { status: 'success', count: pendingDocuments.length };
  },
});

// Job 3: Daily task to execute scheduled promotions
client.defineJob({
  id: 'execute-scheduled-promotions-daily',
  name: 'Execute Scheduled Promotions',
  version: '1.0.0',
  trigger: cronTrigger({
    cron: "1 0 * * *", // Runs every day at 12:01 AM
  }),
  run: async (payload, io, ctx) => {
    await io.logger.info('Starting daily check for scheduled promotions...');
    
    // Find approved promotions that haven't been executed and whose effectiveDate is today or earlier
    const pendingPromotions = await io.runTask('fetch-pending-promotions', async () => {
      return prisma.promotionRequest.findMany({
        where: {
          status: 'APPROVED',
          isExecuted: false,
          effectiveDate: { lte: new Date() }
        }
      });
    });

    if (pendingPromotions.length === 0) {
      await io.logger.info('No scheduled promotions to execute today.');
      return { status: 'success', count: 0 };
    }

    // Dynamic import to avoid circular dependencies in jobs
    const { applyDynamicBenefits } = await import('../utils/benefitsMatrix.js');

    await io.logger.info(`Found ${pendingPromotions.length} scheduled promotions to execute.`);

    let executedCount = 0;
    for (const req of pendingPromotions) {
      await io.runTask(`execute-promotion-${req.id}`, async () => {
        const currentEmployee = await prisma.employee.findUnique({ where: { id: req.employeeId } });
        
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

        await prisma.promotionHistory.create({
          data: {
            employeeId: req.employeeId,
            previousTitle: currentEmployee.jobTitle,
            newTitle: req.newJobTitle || currentEmployee.jobTitle,
            previousGrade: currentEmployee.employeeGrade,
            newGrade: req.newEmployeeGrade || currentEmployee.employeeGrade,
            effectiveDate: req.effectiveDate,
            approvedBy: req.requestedById
          }
        });
        
        await prisma.promotionRequest.update({
          where: { id: req.id },
          data: { isExecuted: true }
        });
        executedCount++;
      });
    }

    return { status: 'success', count: executedCount };
  },
});


// Job 4: Daily task to log milestones like Probation end and Leave start/end
client.defineJob({
  id: 'log-daily-milestones',
  name: 'Log Daily Milestones',
  version: '1.0.0',
  trigger: cronTrigger({
    cron: "5 0 * * *", // Runs every day at 12:05 AM
  }),
  run: async (payload, io, ctx) => {
    await io.logger.info('Starting daily check for milestones...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { AuditEmitterService } = await import('../services/AuditEmitterService.js');

    // Find probations ending today
    const endingProbations = await io.runTask('fetch-ending-probations', async () => {
      return prisma.employee.findMany({
        where: {
          probationEndDate: {
            gte: today,
            lt: tomorrow
          }
        }
      });
    });

    for (const emp of endingProbations) {
      AuditEmitterService.emit('AUDIT_LOG_CREATED', {
        userId: 'system',
        organizationId: emp.organizationId,
        action: 'PROBATION_END',
        entityType: 'Employee',
        entityId: emp.id,
        details: { message: `Probation ended for employee ${emp.firstName} ${emp.lastName}` }
      });
    }

    // Find leaves starting today
    const startingLeaves = await io.runTask('fetch-starting-leaves', async () => {
      return prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          startDate: {
            gte: today,
            lt: tomorrow
          }
        },
        include: { employee: true }
      });
    });

    for (const leave of startingLeaves) {
      AuditEmitterService.emit('AUDIT_LOG_CREATED', {
        userId: 'system',
        organizationId: leave.employee.organizationId,
        action: 'LEAVE_START',
        entityType: 'LeaveRequest',
        entityId: leave.id,
        details: { message: `Leave started for employee ${leave.employee.firstName} ${leave.employee.lastName}` }
      });
    }

    // Find leaves ending today
    const endingLeaves = await io.runTask('fetch-ending-leaves', async () => {
      return prisma.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          endDate: {
            gte: today,
            lt: tomorrow
          }
        },
        include: { employee: true }
      });
    });

    for (const leave of endingLeaves) {
      AuditEmitterService.emit('AUDIT_LOG_CREATED', {
        userId: 'system',
        organizationId: leave.employee.organizationId,
        action: 'LEAVE_END',
        entityType: 'LeaveRequest',
        entityId: leave.id,
        details: { message: `Leave ended for employee ${leave.employee.firstName} ${leave.employee.lastName}` }
      });
    }

    // Find suspensions starting today
    const startingSuspensions = await io.runTask('fetch-starting-suspensions', async () => {
      return prisma.statusHistory.findMany({
        where: {
          status: 'SUSPENDED',
          effectiveDate: {
            gte: today,
            lt: tomorrow
          }
        },
        include: { employee: true }
      });
    });

    for (const susp of startingSuspensions) {
      AuditEmitterService.emit('AUDIT_LOG_CREATED', {
        userId: 'system',
        organizationId: susp.employee.organizationId,
        action: 'SUSPENSION_START',
        entityType: 'StatusHistory',
        entityId: susp.id,
        details: { message: `Suspension started for employee ${susp.employee.firstName} ${susp.employee.lastName}`, reason: susp.reason }
      });
    }
    
    // Find suspensions ending today (if your schema has endDate for suspensions)
    // Note: Assuming `endDate` doesn't exist on StatusHistory. If we had an `endDate`, we would query it similarly.

    // Log the job execution itself
    AuditEmitterService.emit('AUDIT_LOG_CREATED', {
      userId: 'system',
      organizationId: 'system',
      action: 'CRON_JOB_EXECUTED',
      entityType: 'Job',
      entityId: 'log-daily-milestones',
      details: {
        probations: endingProbations.length,
        leavesStarting: startingLeaves.length,
        leavesEnding: endingLeaves.length,
        suspensionsStarting: startingSuspensions.length
      }
    });

    return { status: 'success' };
  },
});
