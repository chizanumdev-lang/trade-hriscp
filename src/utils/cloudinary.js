import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";

export const uploadToCloudinary = async (file) => {
  try {
    // 1. Fetch the secure signature from our backend
    const SIGNATURE_QUERY = gql`
      query GetCloudinarySignature {
        getCloudinarySignature {
          signature
          timestamp
          cloudName
          apiKey
        }
      }
    `;
    const { getCloudinarySignature } = await gqlClient.request(SIGNATURE_QUERY);
    const { signature, timestamp, cloudName, apiKey } = getCloudinarySignature;

    // 2. Upload to Cloudinary using the signature
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    const data = await response.json();
    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
      format: data.format,
      bytes: data.bytes,
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};
