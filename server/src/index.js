import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import dotenv from 'dotenv';
import { prisma } from './db.js';
import { createContext } from './context.js';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';

dotenv.config();

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const PORT = parseInt(process.env.PORT) || 3001;

const { url } = await startStandaloneServer(server, {
  listen: { host: '0.0.0.0', port: PORT },
  context: createContext,
});

console.log(`🚀 Server ready at ${url}`);
