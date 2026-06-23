import React from 'react';
import { Text, Button, Section } from '@react-email/components';
import { BaseTemplate } from './BaseTemplate';

export const DocumentNotificationEmail = ({ isUpload, employeeName, documentName, status, link }) => {
  const title = isUpload ? 'New Document Uploaded' : 'Document Review Update';

  return (
    <BaseTemplate headerTitle="Document Management">
      <Text className="text-slate-800 text-lg font-semibold mb-4 m-0">
        {title}
      </Text>
      <Text className="text-slate-600 text-[15px] leading-relaxed mb-4 m-0">
        {isUpload 
          ? `A new document "${documentName}" has been uploaded by ${employeeName} and requires review.`
          : `The document "${documentName}" submitted by ${employeeName} has been marked as: ${status}.`}
      </Text>
      {link && (
        <Section className="text-center mt-6 mb-4">
          <Button 
            href={link}
            className="bg-indigo-600 rounded-lg text-white font-medium px-6 py-3 text-[14px]"
          >
            View Document
          </Button>
        </Section>
      )}
    </BaseTemplate>
  );
};

export default DocumentNotificationEmail;
