import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  APP_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_TOKEN_PREFIX: z.string().default('crm:token:'),
  REDIS_SESSION_PREFIX: z.string().default('crm:session:'),
  REDIS_RATE_LIMIT_PREFIX: z.string().default('crm:ratelimit:'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // AWS Cognito
  AWS_COGNITO_USER_POOL_ID: z.string(),
  AWS_COGNITO_CLIENT_ID: z.string(),
  AWS_COGNITO_CLIENT_SECRET: z.string().optional(),

  // AWS SES
  AWS_SES_FROM_EMAIL: z.string().email(),
  AWS_SES_REGION: z.string().default('us-east-1'),

  // AWS Secrets Manager
  AWS_SECRETS_MANAGER_REGION: z.string().default('us-east-1'),

  // AWS KMS
  AWS_KMS_KEY_ID: z.string().optional(),

  // GCP
  GCP_PROJECT_ID: z.string(),
  GCP_REGION: z.string().default('us-central1'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Google OAuth2
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // GCP Pub/Sub
  GCP_PUBSUB_TOPIC_AUTH_EVENTS: z.string().default('crm-auth-events'),
  GCP_PUBSUB_TOPIC_USER_EVENTS: z.string().default('crm-user-events'),

  // Apple Sign-In
  APPLE_TEAM_ID: z.string(),
  APPLE_CLIENT_ID: z.string(),
  APPLE_KEY_ID: z.string(),
  APPLE_PRIVATE_KEY_PATH: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  AUTH_RATE_LIMIT_MAX: z.string().default('10'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  port: parseInt(parsed.data.PORT, 10),
  appUrl: parsed.data.APP_URL,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',

  db: {
    url: parsed.data.DATABASE_URL,
  },

  redis: {
    url: parsed.data.REDIS_URL,
    prefixes: {
      token: parsed.data.REDIS_TOKEN_PREFIX,
      session: parsed.data.REDIS_SESSION_PREFIX,
      rateLimit: parsed.data.REDIS_RATE_LIMIT_PREFIX,
    },
  },

  jwt: {
    accessSecret: parsed.data.JWT_ACCESS_SECRET,
    refreshSecret: parsed.data.JWT_REFRESH_SECRET,
    accessExpiresIn: parsed.data.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
  },

  aws: {
    region: parsed.data.AWS_REGION,
    cognito: {
      userPoolId: parsed.data.AWS_COGNITO_USER_POOL_ID,
      clientId: parsed.data.AWS_COGNITO_CLIENT_ID,
      clientSecret: parsed.data.AWS_COGNITO_CLIENT_SECRET,
    },
    ses: {
      fromEmail: parsed.data.AWS_SES_FROM_EMAIL,
      region: parsed.data.AWS_SES_REGION,
    },
    secretsManager: {
      region: parsed.data.AWS_SECRETS_MANAGER_REGION,
    },
    kms: {
      keyId: parsed.data.AWS_KMS_KEY_ID,
    },
  },

  gcp: {
    projectId: parsed.data.GCP_PROJECT_ID,
    region: parsed.data.GCP_REGION,
    google: {
      clientId: parsed.data.GOOGLE_CLIENT_ID,
      clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    },
    pubsub: {
      topics: {
        authEvents: parsed.data.GCP_PUBSUB_TOPIC_AUTH_EVENTS,
        userEvents: parsed.data.GCP_PUBSUB_TOPIC_USER_EVENTS,
      },
    },
  },

  apple: {
    teamId: parsed.data.APPLE_TEAM_ID,
    clientId: parsed.data.APPLE_CLIENT_ID,
    keyId: parsed.data.APPLE_KEY_ID,
    privateKeyPath: parsed.data.APPLE_PRIVATE_KEY_PATH,
  },

  rateLimit: {
    windowMs: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(parsed.data.RATE_LIMIT_MAX_REQUESTS, 10),
    authMaxRequests: parseInt(parsed.data.AUTH_RATE_LIMIT_MAX, 10),
  },
} as const;

export type Config = typeof config;
