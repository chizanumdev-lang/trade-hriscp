import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './db.js';
import { createContext } from './context.js';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';
import { createMiddleware } from '@trigger.dev/express';
import { client } from './jobs/trigger.js';
import { redis } from './utils/redisClient.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Mount Trigger.dev middleware
app.use('/api/trigger', createMiddleware(client));

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

await server.start();

app.use(
  '/graphql',
  expressMiddleware(server, {
    context: createContext,
  })
);

const PORT = parseInt(process.env.PORT) || 3001;

app.listen({ port: PORT, host: '0.0.0.0' }, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
});
