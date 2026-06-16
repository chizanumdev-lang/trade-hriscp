import { prisma } from './src/db.js';
import bcrypt from 'bcryptjs';

async function main() {
  try {
    console.log('Starting DB cleanup and manager creation...');
    
    // Get all departments
    const departments = await prisma.department.findMany({
      include: {
        organization: true
      }
    });
    
    if (departments.length === 0) {
      console.log('No departments found. Cannot create managers for departments.');
      return;
    }
    
    const orgId = departments[0].organizationId;
    
    // Find admin users so we don't delete them
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['SUPER_ADMIN', 'HR_ADMIN']
        }
      }
    });
    const adminEmployeeIds = adminUsers.map(u => u.employeeId).filter(Boolean);
    const adminUserIds = adminUsers.map(u => u.id);
    
    // Find non-admin users to delete
    const nonAdminUsers = await prisma.user.findMany({
      where: {
        role: {
          notIn: ['SUPER_ADMIN', 'HR_ADMIN']
        }
      }
    });
    const nonAdminUserIds = nonAdminUsers.map(u => u.id);
    
    if (nonAdminUserIds.length > 0) {
      console.log(`Cleaning up User relations for ${nonAdminUserIds.length} non-admin users...`);
      await prisma.notification.deleteMany({ where: { userId: { in: nonAdminUserIds } } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: nonAdminUserIds } } });
      
      // We will delete the promotion requests when we delete the employees, but to satisfy User FK we can delete them here or just delete by requestedById
      await prisma.promotionRequest.deleteMany({ where: { requestedById: { in: nonAdminUserIds } } });
      
      // Delete non-admin users
      const deleteUsers = await prisma.user.deleteMany({
        where: {
          id: { in: nonAdminUserIds }
        }
      });
      console.log(`Deleted ${deleteUsers.count} non-admin users.`);
    }
    
    // Clean up employee relations for non-admin employees
    const employeesToDelete = await prisma.employee.findMany({
      where: {
        id: { notIn: adminEmployeeIds }
      }
    });
    const employeeIdsToDelete = employeesToDelete.map(e => e.id);
    
    if (employeeIdsToDelete.length > 0) {
      console.log(`Cleaning up relations for ${employeeIdsToDelete.length} employees...`);
      await prisma.leavePlan.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      
      // Need to handle ApprovalRecord before LeaveRequest etc
      const leaveRequests = await prisma.leaveRequest.findMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.approvalRecord.deleteMany({ where: { leaveRequestId: { in: leaveRequests.map(r => r.id) } } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      
      await prisma.leaveBalance.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.attendance.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.payrollRecord.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      
      // Need to handle document versions before documents
      const docs = await prisma.document.findMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.documentVersion.deleteMany({ where: { documentId: { in: docs.map(d => d.id) } } });
      await prisma.document.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      
      await prisma.goal.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.checkIn.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.checkIn.deleteMany({ where: { managerId: { in: employeeIdsToDelete } } });
      await prisma.onboardingTask.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.offboarding.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.suspension.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.employeeStatusHistory.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.promotionHistory.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.profileUpdateRequest.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.salaryHistory.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.asset.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.expenseClaim.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.loan.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      
      const promotionRequests = await prisma.promotionRequest.findMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      await prisma.approvalRecord.deleteMany({ where: { promotionRequestId: { in: promotionRequests.map(r => r.id) } } });
      await prisma.promotionRequest.deleteMany({ where: { employeeId: { in: employeeIdsToDelete } } });
      
      // Delete Policy Acknowledgments if any
      await prisma.policyAcknowledgment.deleteMany({ where: { userId: { in: nonAdminUserIds } } });
      
      // Finally delete the employees
      // Since managerId references Employee, set managerId to null for admins if they point to deleted
      await prisma.employee.updateMany({
        where: { id: { in: adminEmployeeIds }, managerId: { in: employeeIdsToDelete } },
        data: { managerId: null }
      });
      // Department headEmployeeId might reference these
      await prisma.department.updateMany({
        where: { headEmployeeId: { in: employeeIdsToDelete } },
        data: { headEmployeeId: null }
      });
      
      await prisma.employee.deleteMany({
        where: { id: { in: employeeIdsToDelete } }
      });
      console.log(`Deleted ${employeeIdsToDelete.length} non-admin employees.`);
    }

    // Now create a manager for each department
    console.log('Creating managers for departments...');
    const defaultPassword = await bcrypt.hash('Password123!', 10);
    
    // First Names and Last Names arrays for random generation to make them realistic
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Jessica', 'James', 'Emily', 'Robert', 'Emma', 'William', 'Olivia'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    
    for (let i = 0; i < departments.length; i++) {
      const dept = departments[i];
      const deptNameStr = dept.name.replace(/[^a-zA-Z]/g, '').toLowerCase();
      
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[i % lastNames.length];
      const email = `manager.${deptNameStr}@example.com`;
      const fullName = `${fn} ${ln}`;
      
      const employee = await prisma.employee.create({
        data: {
          employeeCode: `MGR-${1000 + i}`,
          organizationId: orgId,
          fullName: fullName,
          email: email,
          phone: `+23480${Math.floor(Math.random() * 100000000)}`,
          jobTitle: `${dept.name} Manager`,
          departmentId: dept.id,
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          hireDate: new Date('2023-01-01'),
          basicSalary: 800000 + (i * 50000), // Randomish salary
          employeeClass: 'Managerial',
          employeeGrade: 'M1',
          gender: i % 2 === 0 ? 'Male' : 'Female',
          maritalStatus: 'Married',
          nationality: 'Nigerian',
          dateOfBirth: new Date('1985-06-15'),
          residentialAddress: '123 Manager Street, Lagos',
          hmoPlan: 'Gold',
          pensionAdministrator: 'Stanbic IBTC Pension',
          bankName: 'GTBank',
          bankAccountNumber: `001234567${i}`,
          workLocation: 'Lagos Office'
        }
      });
      
      const user = await prisma.user.create({
        data: {
          email: email,
          passwordHash: defaultPassword,
          role: 'MANAGER',
          organizationId: orgId,
          employeeId: employee.id,
          isActive: true
        }
      });
      
      // Set the department head to this manager
      await prisma.department.update({
        where: { id: dept.id },
        data: { headEmployeeId: employee.id }
      });
      
      console.log(`Created manager for ${dept.name}: ${email} (Password123!)`);
    }
    
    console.log('Cleanup and manager creation complete.');
    
  } catch (error) {
    console.error('Error during execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
