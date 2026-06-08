import re
import sys

def main():
    with open('server/src/graphql/resolvers.js', 'r') as f:
        content = f.read()

    # submitLeaveRequest: Set PENDING_HR if employee has no manager
    submit_leave_repl = """    submitLeaveRequest: async (_, { input }, { prisma, user, requireAuth }) => {
      requireAuth();
      if (!user.employeeId) throw new Error("User is not an employee");
      
      const emp = await prisma.employee.findUnique({ where: { id: user.employeeId } });
      const initialStatus = emp.managerId ? 'PENDING' : 'PENDING_HR';

      return prisma.leaveRequest.create({
        data: {
          employeeId: user.employeeId,
          leaveTypeId: input.leaveTypeId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          totalDays: input.totalDays,
          reason: input.reason,
          status: initialStatus
        }
      });
    },"""
    content = re.sub(r'    submitLeaveRequest: async \(_, \{ input \}, \{ prisma, user, requireAuth \}\) => \{.*?status: \'PENDING\'\n        \}\n      \}\);\n    \},', submit_leave_repl, content, flags=re.DOTALL)

    # approveLeaveRequest & rejectLeaveRequest
    leave_repl = """    approveLeaveRequest: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const leave = await prisma.leaveRequest.findUnique({ where: { id } });
      
      let nextStatus = 'APPROVED';
      if (user.role === 'MANAGER' && leave.status === 'PENDING') {
        nextStatus = 'PENDING_HR';
      }
      
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: nextStatus }
      });
      await recordApprovalEvent({ entityType: 'LeaveRequest', entityId: id, approverUserId: user.id, action: nextStatus, previousStatus: leave.status });
      return updated;
    },
    rejectLeaveRequest: async (_, { id, reason }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const leave = await prisma.leaveRequest.findUnique({ where: { id } });
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: { status: 'REJECTED' }
      });
      await recordApprovalEvent({ entityType: 'LeaveRequest', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: leave.status });
      return updated;
    },"""
    content = re.sub(r'    approveLeaveRequest: async \(_, \{ id \}, \{ prisma, user, requireRole \}\) => \{.*?status: \'REJECTED\' \}\n      \}\);\n    \},', leave_repl, content, flags=re.DOTALL)

    # approveDocument & rejectDocument
    doc_repl = """    approveDocument: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const document = await prisma.document.findUnique({ where: { id } });
      const updatedDocument = await prisma.document.update({
        where: { id },
        data: { status: 'ACTIVE' }
      });
      await createAuditLog({ actorId: user.id, entityType: 'Document', entityId: id, action: 'APPROVE' });
      await recordApprovalEvent({ entityType: 'Document', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: document.status });
      return updatedDocument;
    },
    rejectDocument: async (_, { id, reason }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const document = await prisma.document.findUnique({ where: { id } });
      const updatedDocument = await prisma.document.update({
        where: { id },
        data: { status: 'REJECTED' }
      });
      await createAuditLog({ actorId: user.id, entityType: 'Document', entityId: id, action: 'REJECT' });
      await recordApprovalEvent({ entityType: 'Document', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: document.status });
      
      if (reason) {
        await prisma.notification.create({"""
    content = re.sub(r'    approveDocument: async \(_, \{ id \}, \{ prisma, user, requireRole \}\) => \{.*?if \(reason\) \{', doc_repl, content, flags=re.DOTALL)

    # approveProfileUpdateRequest & rejectProfileUpdateRequest
    profile_repl = """    approveProfileUpdateRequest: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const request = await prisma.profileUpdateRequest.findUnique({ where: { id } });
      const updatedRequest = await prisma.profileUpdateRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedBy: user.id }
      });
      const updateData = {};
      updateData[request.fieldName] = request.requestedValue;
      await prisma.employee.update({
        where: { id: request.employeeId },
        data: updateData
      });
      await createAuditLog({ actorId: user.id, entityType: 'ProfileUpdateRequest', entityId: id, action: 'APPROVE' });
      await recordApprovalEvent({ entityType: 'ProfileUpdateRequest', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: request.status });
      return updatedRequest;
    },
    rejectProfileUpdateRequest: async (_, { id, reason }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER']);
      const request = await prisma.profileUpdateRequest.findUnique({ where: { id } });
      const updatedRequest = await prisma.profileUpdateRequest.update({
        where: { id },
        data: { status: 'REJECTED', reviewedBy: user.id }
      });
      await createAuditLog({ actorId: user.id, entityType: 'ProfileUpdateRequest', entityId: id, action: 'REJECT' });
      await recordApprovalEvent({ entityType: 'ProfileUpdateRequest', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: request.status });
      return updatedRequest;
    },"""
    content = re.sub(r'    approveProfileUpdateRequest: async \(_, \{ id \}, \{ prisma, user, requireRole \}\) => \{.*?return request;\n    \},', profile_repl, content, flags=re.DOTALL)

    # approvePayrollRun
    payroll_repl = """    submitPayrollRun: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const pr = await prisma.payrollRun.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'PENDING_APPROVAL' }
      });
      await recordApprovalEvent({ entityType: 'PayrollRun', entityId: id, approverUserId: user.id, action: 'PENDING_APPROVAL', previousStatus: pr.status });
      return updated;
    },
    approvePayrollRun: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'FINANCE_ADMIN']);
      const pr = await prisma.payrollRun.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'APPROVED', approvedBy: user.id }
      });
      await createAuditLog({ actorId: user.id, entityType: 'PayrollRun', entityId: id, action: 'APPROVED' });
      await recordApprovalEvent({ entityType: 'PayrollRun', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: pr.status });
      return updated;
    },
    rejectPayrollRun: async (_, { id, reason }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'FINANCE_ADMIN']);
      const pr = await prisma.payrollRun.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.payrollRun.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'REJECTED' }
      });
      await recordApprovalEvent({ entityType: 'PayrollRun', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: pr.status });
      return updated;
    },"""
    content = re.sub(r'    approvePayrollRun: async \(_, \{ id \}, \{ prisma, user, requireRole \}\) => \{.*?return pr;\n    \},', payroll_repl, content, flags=re.DOTALL)

    # policy operations
    policy_repl = """    createPolicy: async (_, { title, category, content, requiresAck }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      return prisma.policy.create({
        data: { title, category, content, requiresAck, organizationId: user.organizationId, createdBy: user.id, status: 'DRAFT' }
      });
    },
    submitPolicy: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const pol = await prisma.policy.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.policy.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'PENDING' }
      });
      await recordApprovalEvent({ entityType: 'Policy', entityId: id, approverUserId: user.id, action: 'PENDING', previousStatus: pol.status });
      return updated;
    },
    approvePolicy: async (_, { id }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN']);
      const pol = await prisma.policy.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.policy.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'APPROVED' }
      });
      await recordApprovalEvent({ entityType: 'Policy', entityId: id, approverUserId: user.id, action: 'APPROVED', previousStatus: pol.status });
      return updated;
    },
    rejectPolicy: async (_, { id, reason }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN']);
      const pol = await prisma.policy.findUnique({ where: { id, organizationId: user.organizationId } });
      const updated = await prisma.policy.update({
        where: { id, organizationId: user.organizationId },
        data: { status: 'REJECTED' }
      });
      await recordApprovalEvent({ entityType: 'Policy', entityId: id, approverUserId: user.id, action: 'REJECTED', comments: reason, previousStatus: pol.status });
      return updated;
    },"""
    content = re.sub(r'    createPolicy: async \(_, \{ title, category, content, requiresAck \}, \{ prisma, user, requireRole \}\) => \{.*?\}\);\n    \},', policy_repl, content, flags=re.DOTALL)

    with open('server/src/graphql/resolvers.js', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
