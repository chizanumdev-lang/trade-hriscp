import merge from 'lodash.merge';
import { authResolvers } from './auth.resolver.js';
import { orgResolvers } from './org.resolver.js';
import { adminResolvers } from './admin.resolver.js';
import { employeeResolvers } from './employee.resolver.js';
import { leaveResolvers } from './leave.resolver.js';
import { attendanceResolvers } from './attendance.resolver.js';
import { payrollResolvers } from './payroll.resolver.js';
import { documentsResolvers } from './documents.resolver.js';
import { notificationsResolvers } from './notifications.resolver.js';
import { approvalsResolvers } from './approvals.resolver.js';
import { performanceResolvers } from './performance.resolver.js';
import { policyResolvers } from './policy.resolver.js';
import { miscResolvers } from './misc.resolver.js';
import { compensationResolvers } from './compensation.resolver.js';

export const resolvers = merge(
  authResolvers,
  orgResolvers,
  adminResolvers,
  employeeResolvers,
  leaveResolvers,
  attendanceResolvers,
  payrollResolvers,
  documentsResolvers,
  notificationsResolvers,
  approvalsResolvers,
  performanceResolvers,
  policyResolvers,
  miscResolvers,
  compensationResolvers
);
