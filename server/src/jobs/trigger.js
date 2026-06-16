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
          where: { id: req.id },
          data: { isExecuted: true }
        });
        executedCount++;
      });
    }

    return { status: 'success', count: executedCount };
  },
});

