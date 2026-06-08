import { GraphQLClient } from 'graphql-request';
import { appParams } from '@/lib/app-params';

const API_URL = '/graphql';

export const gqlClient = new GraphQLClient(API_URL, {
  headers: () => {
    // We can fetch the token from localStorage or from the context.
    const token = localStorage.getItem('token') || appParams.token;
    if (token) {
      return { authorization: `Bearer ${token}` };
    }
    return {};
  }
});
