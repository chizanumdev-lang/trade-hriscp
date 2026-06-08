import { prisma } from '../db.js';
import { Resend } from 'resend';
// Initialize Resend only if the API key is present
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export class NotificationService {
  /**
   * Send a notification
   * @param {Object} params
   * @param {string} params.userId - Recipient User ID
   * @param {string} params.category - Category (e.g., 'leave', 'payroll', 'approval')
   * @param {string} params.title - Notification title
   * @param {string} params.message - Notification body
   * @param {string} params.deepLink - URL path to relevant record
   * @param {boolean} [params.sendEmail=false] - Whether to also send an email
   */
  static async notify({ userId, category, title, message, deepLink, sendEmail = false }) {
    try {
      // 1. Create the in-app notification record
      const notification = await prisma.notification.create({
        data: {
          userId,
          category,
          title,
          message,
          deepLink,
          channel: 'IN_APP',
        }
      });

      // 2. Send email via Resend if requested
      if (sendEmail) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, employee: { select: { fullName: true } } }
        });

        if (user?.email) {
          if (resend) {
            // Note: Railway provided domains (.up.railway.app) cannot be verified on Resend
            // because you don't control their DNS records.
            // For MVP/testing, Resend allows sending from onboarding@resend.dev to the 
            // email address you verified when signing up for Resend.
            const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            
            await resend.emails.send({
              from: `TradeVu HR <${fromEmail}>`,
              to: [user.email],
              subject: title,
              html: `
                <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
                  <h2 style="color: #4f46e5;">${title}</h2>
                  <p>Hi ${user.employee?.fullName || 'there'},</p>
                  <p>${message}</p>
                  ${deepLink ? `<a href="${frontendUrl}${deepLink}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 24px; font-weight: bold;">View Details</a>` : ''}
                  <p style="margin-top: 30px; font-size: 12px; color: #888;">
                    This is an automated message from your TradeVu HR portal.
                  </p>
                </div>
              `
            });
            console.log(`[NotificationService] Email dispatched to ${user.email} via Resend.`);
          } else {
            console.log(`[NotificationService] Resend API Key missing. Mocking email to ${user.email}`);
            console.log(`Subject: ${title}`);
            console.log(`Body: ${message}`);
          }
        }
      }

      return notification;
    } catch (error) {
      console.error("[NotificationService] Failed to send notification:", error);
      // We log but don't throw to prevent interrupting the main business flow
    }
  }
}
