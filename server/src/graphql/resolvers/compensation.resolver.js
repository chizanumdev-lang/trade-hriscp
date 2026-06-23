import { createAuditLog } from '../../utils/audit.js';

export const compensationResolvers = {
  Query: {
    compensationStructures: async (_, __, { prisma, user, requireRole }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']);
      return prisma.compensationStructure.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' }
      });
    }
  },
  Mutation: {
    createCompensationStructure: async (_, { input }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      
      const structure = await prisma.compensationStructure.create({
        data: {
          name: input.name,
          departmentId: input.departmentId,
          gradeLevel: input.gradeLevel,
          effectiveDate: new Date(input.effectiveDate),
          components: input.components,
          organizationId: user.organizationId,
          status: 'ACTIVE'
        }
      });
      
      await createAuditLog({
        prisma, ipAddress, userId: user.id, organizationId: user.organizationId, 
        entityType: 'CompensationStructure', entityId: structure.id,
        action: 'CREATED', newValue: input
      });
      
      return structure;
    },
    updateCompensationStructure: async (_, { id, input }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      
      const data = {};
      if (input.name) data.name = input.name;
      if (input.departmentId !== undefined) data.departmentId = input.departmentId;
      if (input.gradeLevel !== undefined) data.gradeLevel = input.gradeLevel;
      if (input.effectiveDate) data.effectiveDate = new Date(input.effectiveDate);
      if (input.components) data.components = input.components;

      const structure = await prisma.compensationStructure.update({
        where: { id, organizationId: user.organizationId },
        data
      });
      
      await createAuditLog({
        prisma, ipAddress, userId: user.id, organizationId: user.organizationId, 
        entityType: 'CompensationStructure', entityId: id,
        action: 'UPDATED', newValue: input
      });
      
      return structure;
    },
    assignEmployeeCompensation: async (_, { employeeId, compensationStructureId, salaryAmount, overrides, effectiveDate }, { prisma, user, requireRole, ipAddress }) => {
      requireRole(['SUPER_ADMIN', 'HR_ADMIN']);
      
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId, organizationId: user.organizationId }
      });
      if (!employee) throw new Error("Employee not found or unauthorized");
      
      const empComp = await prisma.employeeCompensation.upsert({
        where: { employeeId },
        update: {
          compensationStructureId,
          salaryAmount,
          overrides: overrides || {},
          effectiveDate: new Date(effectiveDate)
        },
        create: {
          employeeId,
          compensationStructureId,
          salaryAmount,
          overrides: overrides || {},
          effectiveDate: new Date(effectiveDate)
        }
      });
      
      await createAuditLog({
        prisma, ipAddress, userId: user.id, organizationId: user.organizationId, 
        entityType: 'EmployeeCompensation', entityId: empComp.id,
        action: 'ASSIGNED', newValue: { employeeId, compensationStructureId, salaryAmount, overrides }
      });
      
      return empComp;
    }
  }
};
