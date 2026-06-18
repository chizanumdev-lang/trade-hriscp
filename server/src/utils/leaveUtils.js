// Utility functions for Leave Management calculations

/**
 * Calculates the number of business days between two dates, excluding weekends and public holidays.
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {Array} publicHolidays - Array of public holiday dates
 * @returns {number} Number of business days
 */
export const calculateBusinessDays = (startDate, endDate, publicHolidays = []) => {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  const holidayStrings = publicHolidays.map(h => h.toISOString().split('T')[0]);

  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    const dateString = curDate.toISOString().split('T')[0];

    // Exclude weekends (0 = Sunday, 6 = Saturday) and public holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayStrings.includes(dateString)) {
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
};

/**
 * Validates if an employee has sufficient leave balance
 * @param {string} employeeId 
 * @param {string} leaveTypeId 
 * @param {number} requestedDays 
 * @param {object} prisma - Prisma client
 * @returns {object} Object indicating validity and current balance
 */
export const validateLeaveBalance = async (employeeId, leaveTypeId, requestedDays, prisma) => {
  const currentYear = new Date().getFullYear();
  
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year: currentYear
      }
    }
  });

  if (!balance) {
    return { isValid: false, reason: 'No leave balance found for this year.' };
  }

  if (balance.available < requestedDays) {
    return { isValid: false, reason: `Insufficient balance. Available: ${balance.available} days.` };
  }

  return { isValid: true, balance };
};
