// server/src/utils/benefitsMatrix.js

export const applyDynamicBenefits = async (employeeId, newGrade, prisma) => {
  // If no grade provided, do nothing
  if (!newGrade) return;

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return;

  const organizationId = emp.organizationId;

  // 1. Fetch the CompensationBand for this organization and grade
  const band = await prisma.compensationBand.findUnique({
    where: {
      organizationId_grade: {
        organizationId,
        grade: newGrade,
      }
    }
  });

  // Default values if no band is configured yet for this grade
  let hmoPlan = "Bronze";
  let annualLeaveDays = 15;
  let newBasicSalary = emp.basicSalary || 0; // Don't change if not configured
  
  if (band) {
    hmoPlan = band.hmoPlan;
    annualLeaveDays = band.annualLeaveDays;
    
    // Auto-adjust salary to minimum if it's below the new band's minimum,
    // or max if it's above the max.
    if (!emp.basicSalary || emp.basicSalary < band.minSalary) {
      newBasicSalary = band.minSalary;
    } else if (emp.basicSalary > band.maxSalary) {
      newBasicSalary = band.maxSalary;
    } else {
      newBasicSalary = emp.basicSalary;
    }
  } else {
    // Hardcoded fallback rules from Handbook if band doesn't exist
    if (newGrade === 'CEO') {
      annualLeaveDays = 28;
      hmoPlan = 'Platinum';
    } else if (newGrade === 'Department Head' || newGrade === 'Management') {
      annualLeaveDays = 25;
      hmoPlan = 'Platinum';
    } else if (newGrade === 'Senior Level') {
      annualLeaveDays = 15;
      hmoPlan = 'Gold';
    } else if (newGrade === 'Mid-Level') {
      annualLeaveDays = 15;
      hmoPlan = 'Silver';
    } else if (newGrade === 'Entry Level' || newGrade === 'Team Member') {
      annualLeaveDays = 15;
      hmoPlan = 'Bronze';
    }
  }

  // 2. Update the Employee's salary and HMO
  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      hmoPlan,
      basicSalary: newBasicSalary
    }
  });

  // 3. Find the "Annual Leave" leave type for the organization
  const annualLeaveType = await prisma.leaveType.findFirst({
    where: {
      organizationId,
      name: {
        contains: 'Annual',
        mode: 'insensitive'
      }
    }
  });

  if (annualLeaveType) {
    const currentYear = new Date().getFullYear();
    
    // 4. Upsert the LeaveBalance for this year
    const existingBalance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: annualLeaveType.id,
          year: currentYear
        }
      }
    });

    if (existingBalance) {
      // Recalculate available based on new entitled minus used/pending
      const usedAndPending = existingBalance.used + existingBalance.pending;
      const newAvailable = annualLeaveDays - usedAndPending;
      
      await prisma.leaveBalance.update({
        where: { id: existingBalance.id },
        data: {
          totalEntitled: annualLeaveDays,
          available: newAvailable >= 0 ? newAvailable : 0
        }
      });
    } else {
      await prisma.leaveBalance.create({
        data: {
          employeeId,
          leaveTypeId: annualLeaveType.id,
          year: currentYear,
          totalEntitled: annualLeaveDays,
          available: annualLeaveDays,
          used: 0,
          pending: 0
        }
      });
    }
  }
};
