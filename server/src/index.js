import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { prisma } from './db.js';
import { createContext } from './context.js';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';

dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

await server.start();

// Set up Apollo Server middleware
app.use('/graphql', expressMiddleware(server, {
  context: createContext,
}));

// Serve static frontend files from the dist directory
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

// Catch-all route to serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

const PORT = parseInt(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`🚀 GraphQL API ready at http://localhost:${PORT}/graphql`);
  console.log(`🖥️  Frontend ready at http://localhost:${PORT}`);
});
