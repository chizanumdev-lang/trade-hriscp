import React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { BaseTemplate } from './BaseTemplate';

export const ProbationOffboardingEmail = ({ type, employeeName, status, link }) => {
  const isOffboarding = type === 'offboarding';
  const title = isOffboarding ? 'Offboarding Update' : 'Probation Update';
  
  return (
    <BaseTemplate headerTitle={title}>
      <Text className="text-slate-800 text-lg font-semibold mb-4 m-0">
        {title}
      </Text>
      <Text className="text-slate-600 text-[15px] leading-relaxed mb-6 m-0">
        There is an update regarding the {isOffboarding ? 'offboarding' : 'probation'} process for <strong>{employeeName}</strong>. 
        Current status: <strong>{status}</strong>.
      </Text>
      {link && (
        <Section className="text-center mt-6 mb-4">
          <Button 
            href={link}
            className="bg-indigo-600 rounded-lg text-white font-medium px-6 py-3 text-[14px]"
          >
            View Details
          </Button>
        </Section>
      )}
    </BaseTemplate>
  );
};

export default ProbationOffboardingEmail;
