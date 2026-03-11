import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { makeExecutableSchema } from '@graphql-tools/schema';
import express from 'express';
import http from 'http';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { createContext } from './context';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { cacheService } from './services/cache.service';
import { config } from './config';
import { logger } from './utils/logger';

async function bootstrap() {
  // ─── Database ────────────────────────────────────────────────────────────────
  const prisma = new PrismaClient({
    log: config.isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  await prisma.$connect();
  logger.info('Database connected');

  // ─── Redis ───────────────────────────────────────────────────────────────────
  await cacheService.connect();

  // ─── Express ─────────────────────────────────────────────────────────────────
  const app = express();
  const httpServer = http.createServer(app);

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: config.isProd ? undefined : false,
      crossOriginEmbedderPolicy: config.isProd,
    })
  );

  app.use(compression());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.includes(origin) || config.isDev) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(tenantMiddleware);

  // Global rate limit
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // ─── Health Check ─────────────────────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'unhealthy' });
    }
  });

  // ─── Apollo Server ────────────────────────────────────────────────────────────
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      config.isDev
        ? ApolloServerPluginLandingPageLocalDefault({ includeCookies: true })
        : { async requestDidStart() { return {}; } },
    ],
    introspection: config.isDev,
    formatError: (formattedError, error) => {
      logger.error('GraphQL error', {
        message: formattedError.message,
        path: formattedError.path,
        extensions: formattedError.extensions,
      });

      // Hide internal implementation details in production
      if (config.isProd && formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        return { message: 'Internal server error', extensions: { code: 'INTERNAL_ERROR' } };
      }

      return formattedError;
    },
  });

  await server.start();

  // Auth-specific rate limit (stricter)
  const authRateLimit = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Only rate-limit mutation operations (login, register, etc.)
      const body = req.body as { operationName?: string };
      const authOps = ['Login', 'Register', 'LoginWithGoogle', 'LoginWithApple', 'ForgotPassword'];
      return !authOps.some((op) => body.operationName?.includes(op));
    },
  });

  app.use(
    '/graphql',
    authRateLimit,
    expressMiddleware(server, {
      context: createContext(prisma),
    })
  );

  // ─── Start ────────────────────────────────────────────────────────────────────
  await new Promise<void>((resolve) => httpServer.listen({ port: config.port }, resolve));

  logger.info(`Server ready at http://localhost:${config.port}/graphql`);
  logger.info(`Environment: ${config.env}`);

  // ─── Graceful Shutdown ────────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await server.stop();
    await prisma.$disconnect();
    await cacheService.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
