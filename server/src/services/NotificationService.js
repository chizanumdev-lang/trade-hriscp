import { prisma } from '../db.js';
import { Resend } from 'resend';
import React from 'react';
import { render } from '@react-email/render';
import WelcomeEmail from '../emails/WelcomeEmail.jsx';
import LeaveUpdateEmail from '../emails/LeaveUpdateEmail.jsx';
import PromotionEmail from '../emails/PromotionEmail.jsx';
import EmployeeCreationEmail from '../emails/EmployeeCreationEmail.jsx';
import EmployeeActivationEmail from '../emails/EmployeeActivationEmail.jsx';
import ProbationNoticeEmail from '../emails/ProbationNoticeEmail.jsx';
import SuspensionNoticeEmail from '../emails/SuspensionNoticeEmail.jsx';
import ExitNoticeEmail from '../emails/ExitNoticeEmail.jsx';
import BaseTemplate from '../emails/BaseTemplate.jsx';
import ProfileCompletionEmail from '../emails/ProfileCompletionEmail.jsx';
import ProfileUpdateEmail from '../emails/ProfileUpdateEmail.jsx';
import ProbationOffboardingEmail from '../emails/ProbationOffboardingEmail.jsx';
import ExpenseAssetEmail from '../emails/ExpenseAssetEmail.jsx';
import DocumentNotificationEmail from '../emails/DocumentNotificationEmail.jsx';

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
   * @param {Object} [params.emailProps={}] - Specific props for customized email templates
   */
  static async notify({ userId, category, title, message, deepLink, sendEmail = false, emailProps = {} }) {
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
            
            let htmlContent;
            try {
              if (category === 'onboarding_welcome') {
                htmlContent = await render(React.createElement(WelcomeEmail, { fullName: user.employee?.fullName, ...emailProps, deepLink }));
              } else if (category === 'leave') {
                htmlContent = await render(React.createElement(LeaveUpdateEmail, { fullName: user.employee?.fullName, ...emailProps, deepLink }));
              } else if (category === 'promotion') {
                htmlContent = await render(React.createElement(PromotionEmail, { fullName: user.employee?.fullName, ...emailProps, deepLink }));
              } else if (category === 'employee_created') {
                htmlContent = await render(React.createElement(EmployeeCreationEmail, { fullName: user.employee?.fullName, ...emailProps, deepLink }));
              } else if (category === 'employee_activated') {
                htmlContent = await render(React.createElement(EmployeeActivationEmail, { fullName: user.employee?.fullName, ...emailProps, deepLink }));
              } else if (category === 'probation_update') {
                htmlContent = await render(React.createElement(ProbationNoticeEmail, { fullName: user.employee?.fullName, ...emailProps, deepLink }));
              } else if (category === 'suspension_notice') {
                htmlContent = await render(React.createElement(SuspensionNoticeEmail, { fullName: user.employee?.fullName, ...emailProps, deepLink }));
              } else if (category === 'exit_notice') {
                htmlContent = await render(React.createElement(ExitNoticeEmail, { fullName: user.employee?.fullName, ...emailProps, deepLink }));
              } else if (category === 'PROFILE_COMPLETION') {
                htmlContent = await render(React.createElement(ProfileCompletionEmail, { link: deepLink ? `${frontendUrl}${deepLink}` : frontendUrl, ...emailProps }));
              } else if (category === 'PROFILE_UPDATE') {
                htmlContent = await render(React.createElement(ProfileUpdateEmail, { link: deepLink ? `${frontendUrl}${deepLink}` : frontendUrl, ...emailProps }));
              } else if (category === 'PROBATION_OFFBOARDING') {
                htmlContent = await render(React.createElement(ProbationOffboardingEmail, { link: deepLink ? `${frontendUrl}${deepLink}` : frontendUrl, ...emailProps }));
              } else if (category === 'EXPENSE_ASSET') {
                htmlContent = await render(React.createElement(ExpenseAssetEmail, { link: deepLink ? `${frontendUrl}${deepLink}` : frontendUrl, ...emailProps }));
              } else if (category === 'DOCUMENT_NOTIFICATION') {
                htmlContent = await render(React.createElement(DocumentNotificationEmail, { link: deepLink ? `${frontendUrl}${deepLink}` : frontendUrl, ...emailProps }));
              } else {
                htmlContent = await render(React.createElement(BaseTemplate, { previewText: title }, 
                  React.createElement('div', { style: { fontFamily: 'sans-serif' } },
                    React.createElement('h2', { className: "text-2xl font-bold text-slate-900 mb-4 mt-0" }, title),
                    React.createElement('p', { className: "text-base text-slate-700 leading-relaxed mb-4" }, `Hi ${user.employee?.fullName || 'there'},`),
                    React.createElement('p', { className: "text-base text-slate-700 leading-relaxed mb-6" }, message),
                    deepLink && React.createElement('a', { href: `${frontendUrl}${deepLink}`, className: "bg-purple-600 text-white font-semibold rounded-lg px-6 py-3 no-underline text-center inline-block" }, "View Details")
                  )
                ));
              }
            } catch (err) {
              console.error("Error rendering React Email:", err);
              htmlContent = `<p>${message}</p>`; // Fallback
            }

            await resend.emails.send({
              from: `TradeVu HR <${fromEmail}>`,
              to: [user.email],
              subject: title,
              html: htmlContent
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
