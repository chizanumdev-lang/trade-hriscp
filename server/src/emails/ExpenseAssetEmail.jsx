import React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { BaseTemplate } from './BaseTemplate';

export const ExpenseAssetEmail = ({ type, employeeName, details, link }) => {
  const isExpense = type === 'expense';
  const title = isExpense ? 'Expense Claim' : 'Asset Assignment';

  return (
    <BaseTemplate headerTitle={title}>
      <Text className="text-slate-800 text-lg font-semibold mb-4 m-0">
        {title} Notification
      </Text>
      <Text className="text-slate-600 text-[15px] leading-relaxed mb-4 m-0">
        A new {isExpense ? 'expense claim' : 'asset update'} has been submitted for <strong>{employeeName}</strong>.
      </Text>
      <Section className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
        <Text className="text-slate-700 text-[14px] m-0">
          <strong>Details:</strong> {details}
        </Text>
      </Section>
      {link && (
        <Section className="text-center mt-6 mb-4">
          <Button 
            href={link}
            className="bg-indigo-600 rounded-lg text-white font-medium px-6 py-3 text-[14px]"
          >
            View {isExpense ? 'Claim' : 'Asset'}
          </Button>
        </Section>
      )}
    </BaseTemplate>
  );
};

export default ExpenseAssetEmail;
