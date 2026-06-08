import re

with open('src/graphql/resolvers.js', 'r') as f:
    content = f.read()

# Add auditLogs to Query
query_start = content.find('Query: {')
me_query = content.find('me: async', query_start)
audit_query = """    auditLogs: async (_, { entityType, action, limit }, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      const where = {};
      if (entityType) where.entityType = entityType;
      if (action) where.action = action;
      const logs = await prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, take: limit || 100, include: { actor: true }
      });
      return logs.map(log => ({
        ...log,
        previousValue: log.previousValue ? JSON.stringify(log.previousValue) : null,
        newValue: log.newValue ? JSON.stringify(log.newValue) : null,
      }));
    },
"""
content = content[:me_query] + audit_query + content[me_query:]

# Add ipAddress to context destructuring globally in Mutation resolvers
content = re.sub(r'(_, {[^}]*}, { prisma, user, requireAuth })', r'\1, ipAddress', content)
content = re.sub(r'(_, {[^}]*}, { prisma, user, requireRole })', r'\1, ipAddress', content)
# Fix the regex destructuring manually
content = content.replace('{ prisma, user, requireAuth }, ipAddress', '{ prisma, user, requireAuth, ipAddress }')
content = content.replace('{ prisma, user, requireRole }, ipAddress', '{ prisma, user, requireRole, ipAddress }')

# Fix createEmployee
content = content.replace("action: 'CREATE' });", "action: 'CREATE', newValue: emp, ipAddress });")
# Fix updateEmployee
content = content.replace("action: 'UPDATE' });", "action: 'UPDATE', previousValue: existing, newValue: updatedEmp, ipAddress });")
# Fix updateEmployeeSelf
content = content.replace("action: 'UPDATE_SELF' });", "action: 'UPDATE_SELF', previousValue: existing, newValue: updatedEmp, ipAddress });")
# Fix deleteEmployee
content = content.replace("action: 'DELETE' });", "action: 'DELETE', previousValue: empToDelete, ipAddress });")
# Fix startOnboarding
content = content.replace("action: 'START_ONBOARDING' });", "action: 'START_ONBOARDING', ipAddress });")
# Fix submitLeaveRequest
content = content.replace("await createAuditLog({ ", "await createAuditLog({ ipAddress, ")
# Fix submitPolicy
content = content.replace("action: 'SUBMITTED' });", "action: 'SUBMITTED', newValue: updated, ipAddress });")
# Fix approvePolicy
content = content.replace("action: 'APPROVED' });", "action: 'APPROVED', previousValue: policy, newValue: updated, ipAddress });")
# Fix requestCompensationUpdate
content = content.replace("action: 'CREATED' });", "action: 'CREATED', previousValue: { basicSalary: employee.basicSalary, allowances: employee.allowances }, newValue: record, ipAddress });")
# Fix approvePayrollRun
content = content.replace("action: 'APPROVED' });", "action: 'APPROVED', previousValue: run, newValue: updated, ipAddress });")
# Fix uploadDocument
content = content.replace("action: 'CREATE', newValue: doc });", "action: 'CREATE', newValue: doc, ipAddress });")

with open('src/graphql/resolvers.js', 'w') as f:
    f.write(content)
