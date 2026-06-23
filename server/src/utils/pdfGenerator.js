import PDFDocument from 'pdfkit';

async function generatePayslipPdf(record) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        const base64Data = pdfData.toString('base64');
        resolve(base64Data);
      });

      const { employee, payrollRun } = record;

      // Header
      doc.fontSize(20).text('PAYSLIP', { align: 'center' });
      doc.moveDown();

      // Company Info (Placeholder for now)
      doc.fontSize(10).text('Tradevu HR', { align: 'right' });
      doc.text(`Period: ${new Date(payrollRun.startDate).toLocaleDateString()} - ${new Date(payrollRun.endDate).toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();

      // Employee Info
      doc.fontSize(12).text(`Employee Name: ${employee.fullName}`);
      doc.text(`Job Title: ${employee.jobTitle}`);
      doc.text(`Department: ${employee.department ? employee.department.name : 'N/A'}`);
      doc.moveDown();

      // Earnings
      doc.fontSize(14).text('Earnings', { underline: true });
      doc.fontSize(10).text(`Basic Salary: ${record.basicSalary.toLocaleString()} SAR`);
      
      const allowances = record.allowances || {};
      for (const [key, val] of Object.entries(allowances)) {
        doc.text(`${key}: ${Number(val).toLocaleString()} SAR`);
      }
      doc.moveDown();
      doc.fontSize(12).text(`Gross Pay: ${record.grossPay.toLocaleString()} SAR`);
      doc.moveDown();

      // Deductions
      doc.fontSize(14).text('Deductions', { underline: true });
      const deductions = record.deductions || {};
      for (const [key, val] of Object.entries(deductions)) {
        doc.text(`${key}: ${Number(val).toLocaleString()} SAR`);
      }
      doc.moveDown();
      
      const totalDeductions = Object.values(deductions).reduce((acc, val) => acc + Number(val), 0);
      doc.fontSize(12).text(`Total Deductions: ${totalDeductions.toLocaleString()} SAR`);
      doc.moveDown(2);

      // Net Pay
      doc.fontSize(16).text(`Net Pay: ${record.netPay.toLocaleString()} SAR`, { bold: true });

      // Footer
      doc.moveDown(4);
      doc.fontSize(10).text('This is a computer-generated document. No signature is required.', { align: 'center', color: 'grey' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export { generatePayslipPdf };
