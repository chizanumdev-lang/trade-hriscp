// Utility functions for Payroll Management calculations

/**
 * Calculates a single payslip for an employee based on their compensation structure.
 * @param {object} employee 
 * @param {object} compensationStructure 
 * @param {object} monthData - e.g. { year, month }
 * @param {Array} adjustments - Any specific adjustments for this month
 * @returns {object} Calculated payslip data
 */
export const calculatePayslip = (employee, compensationStructure, monthData, adjustments = []) => {
  let basicSalary = 0;
  let allowances = 0;
  let deductions = 0;

  // Assuming compensationStructure has components like { earnings: { basic: 500000, housing: 100000 }, deductions: { tax: 50000 } }
  const components = compensationStructure.components || { earnings: {}, deductions: {} };
  
  // Calculate Base Earnings
  if (components.earnings) {
    if (components.earnings.basic) basicSalary = Number(components.earnings.basic);
    
    // Sum other allowances
    Object.entries(components.earnings).forEach(([key, value]) => {
      if (key !== 'basic') allowances += Number(value);
    });
  }

  // Calculate Deductions
  if (components.deductions) {
    Object.values(components.deductions).forEach(value => {
      deductions += Number(value);
    });
  }

  // Apply Adjustments (Bonus, etc)
  adjustments.forEach(adj => {
    if (adj.type === 'BONUS' || adj.type === 'REIMBURSEMENT') {
      allowances += Number(adj.amount);
    } else if (adj.type === 'DEDUCTION') {
      deductions += Number(adj.amount);
    }
  });

  // Calculate Net
  const grossPay = basicSalary + allowances;
  const netPay = grossPay - deductions;

  return {
    basicSalary,
    allowances,
    deductions,
    grossPay,
    netPay,
    currency: 'NGN'
  };
};

/**
 * Generates 60/40 payment batches
 * @param {Array} payslips 
 * @returns {Array} Array of batches [{ batchLabel, percentage, records }]
 */
export const generatePaymentBatches = (payslips) => {
  const batch1 = [];
  const batch2 = [];

  payslips.forEach(ps => {
    batch1.push({
      employeeId: ps.employeeId,
      amount: Number((ps.netPay * 0.6).toFixed(2))
    });
    batch2.push({
      employeeId: ps.employeeId,
      amount: Number((ps.netPay * 0.4).toFixed(2))
    });
  });

  return [
    { batchLabel: 'FIRST', percentage: 60, records: batch1 },
    { batchLabel: 'SECOND', percentage: 40, records: batch2 }
  ];
};
