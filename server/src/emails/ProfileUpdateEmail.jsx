import React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { BaseTemplate } from './BaseTemplate';

export const ProfileUpdateEmail = ({ employeeName, fieldName, requestedValue, link }) => {
  return (
    <BaseTemplate headerTitle="Profile Update Request">
      <Text className="text-slate-800 text-lg font-semibold mb-4 m-0">
        Profile Update Request
      </Text>
      <Text className="text-slate-600 text-[15px] leading-relaxed mb-4 m-0">
        <strong>{employeeName}</strong> has requested to update their profile information.
      </Text>
      <Section className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
        <Text className="text-slate-700 text-[14px] m-0 mb-1">
          <strong>Field:</strong> {fieldName}
        </Text>
        <Text className="text-slate-700 text-[14px] m-0">
          <strong>New Value:</strong> {requestedValue}
        </Text>
      </Section>
      <Section className="text-center mt-6 mb-4">
        <Button 
          href={link}
          className="bg-indigo-600 rounded-lg text-white font-medium px-6 py-3 text-[14px]"
        >
          Review Request
        </Button>
      </Section>
    </BaseTemplate>
  );
};

export default ProfileUpdateEmail;
