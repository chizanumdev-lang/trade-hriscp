import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-validation-complexity';
import { prisma } from './db.js';
import { createContext } from './context.js';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers/index.js';
import { createMiddleware } from '@trigger.dev/express';
import { client } from './jobs/trigger.js';
import { redis } from './utils/redisClient.js';
import logger from './utils/logger.js';
import { requestId } from './middleware/requestId.js';
import { globalLimiter } from './middleware/rateLimiter.js';

dotenv.config();

// ─── Startup validation ──────────────────────────────────────────────────────
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    logger.fatal({ missingVar: key }, `Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ─── App setup ───────────────────────────────────────────────────────────────
const app = express();

app.use(helmet({
  hsts: {
    maxAge: 31536000,       // 1 year
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'https://trade-hriscp.vercel.app'];
app.use(cors({ origin: allowedOrigins }));

app.use(requestId);

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      };
    },
  },
}));

// Apply global rate limiter
app.use(globalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use(express.json());

// Mount Trigger.dev middleware
app.use('/api/trigger', createMiddleware(client));

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(10),
    createComplexityLimitRule(1000, {
      onCost: (cost) => logger.info({ cost }, 'Query cost'),
    }),
  ],
});

await server.start();

app.use(
  '/graphql',
  expressMiddleware(server, {
    context: createContext,
  })
);

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(
    { requestId: req.id, error: err.message, stack: err.stack },
    'Unhandled error'
  );
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = parseInt(process.env.PORT) || 3001;

const httpServer = app.listen({ port: PORT, host: '0.0.0.0' }, () => {
  logger.info({ port: PORT }, `🚀 Server ready at http://localhost:${PORT}/graphql`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received — closing server gracefully');

  httpServer.close(async () => {
    logger.info('HTTP server closed. Draining connections...');
    await prisma.$disconnect();
    logger.info('Shutdown complete.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
