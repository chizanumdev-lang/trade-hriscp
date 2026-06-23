import React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { BaseTemplate } from './BaseTemplate';

export const ProfileCompletionEmail = ({ employeeName, link }) => {
  return (
    <BaseTemplate headerTitle="Profile Completed">
      <Text className="text-slate-800 text-lg font-semibold mb-4 m-0">
        Action Required: Profile Approval
      </Text>
      <Text className="text-slate-600 text-[15px] leading-relaxed mb-6 m-0">
        <strong>{employeeName}</strong> has finished setting up their profile and is now waiting for HR approval. 
        Please review their submitted details and documents to proceed.
      </Text>
      <Section className="text-center mt-8 mb-4">
        <Button 
          href={link}
          className="bg-indigo-600 rounded-lg text-white font-medium px-6 py-3 text-[14px]"
        >
          Review Profile
        </Button>
      </Section>
    </BaseTemplate>
  );
};

export default ProfileCompletionEmail;
