import { z } from 'zod';

const requiredInProduction = [
  'DATABASE_URL',
  'REDIS_URL',
  'SERVER_URL',
  'FRONTEND_URL',
  'CORS_ORIGINS',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'JWT_SECRET',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_MFA_SECRET',
  'JWT_ONBOARDING_SECRET',
  'AUTH_ENCRYPTION_KEY',
  'PRIVY_APP_ID',
  'PRIVY_SECRET',
  'PRIVY_JWKS_URL',
  'INTERNAL_API_KEY',
  'HELIUS_WEBHOOK_SECRET',
  'WALLET_CHALLENGE_SECRET',
  'SOLANA_RPC_URL',
  'GOOGLE_AI_API_KEY',
] as const;

const requiredForGithubAuth = [
  'GITHUB_APP_ID',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_PRIVATE_KEY',
  'GITHUB_SYSTEM_TOKEN',
] as const;

const deployedEnvironments = new Set<string>(['staging', 'production']);
const encryptionKeySchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'must be a 64-character hex string (32 bytes)',);

const hasPrismaPooler = (databaseUrl: string) => {
  try {
    const url = new URL(databaseUrl);
    return (
      url.searchParams.get('connection_limit') === '5' ||
      url.searchParams.get('pgbouncer') === 'true'
    );
  } catch {
    return false;
  }
};

export const envSchema = z
  .object({
    DATABASE_URL: z.string().optional(),

    NODE_ENV: z
      .enum(['development', 'staging', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    SERVER_URL: z.string().url().optional(),
    FRONTEND_URL: z.string().url().optional(),
    CORS_ORIGINS: z.string().optional(),
    REDIS_URL: z
      .string()
      .regex(/^rediss?:\/\//, 'REDIS_URL must use redis:// or rediss://')
      .optional(),

    GITHUB_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
    GITHUB_APP_ID: z.coerce.number().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GITHUB_PRIVATE_KEY: z.string().optional(),
    GITHUB_SYSTEM_TOKEN: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    JWT_SECRET: z.string().min(32).optional(),
    JWT_ACCESS_SECRET: z.string().min(32).optional(),
    JWT_REFRESH_SECRET: z.string().min(32).optional(),
    JWT_MFA_SECRET: z.string().min(32).optional(),
    JWT_ONBOARDING_SECRET: z.string().min(32).optional(),
    JWT_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    JWT_ISSUER: z.string().default('colosseum-api'),
    JWT_AUDIENCE: z.string().default('colosseum-client'),

    PRIVY_APP_ID: z.string().optional(),
    PRIVY_SECRET: z.string().optional(),
    PRIVY_JWKS_URL: z.string().url().optional(),
    PRIVY_BYPASS: z.enum(['true', 'false']).default('false'),

    AUTH_ENCRYPTION_KEY: encryptionKeySchema.optional(),
    ENCRYPTION_KEY: encryptionKeySchema.optional(),
    INTERNAL_API_KEY: z.string().optional(),

    HELIUS_API_KEY: z.string().optional(),
    HELIUS_WEBHOOK_SECRET: z.string().optional(),
    WALLET_CHALLENGE_SECRET: z.string().optional(),
    // APP_BASE_URL: z.string().url().optional(),
    // VOUCH_ICON_URL: z.string().url().optional(),
    SOLANA_RPC_URL: z.string().url().optional(),
    SOLANA_DEVNET_RPC_URL: z
      .string()
      .url()
      .default('https://api.devnet.solana.com'),
    USING_DEVNET: z.enum(['true', 'false']).default('true'),

    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM: z.string().email().optional(),
    SENTRY_DSN: z.string().optional(),

    GOOGLE_AI_API_KEY: z.string().optional(),
    RPC_URL: z.string().url().optional(),
    ALCHEMY_API_KEY: z.string().optional(),
    RUN_WORKERS: z.enum(['true', 'false']).default('false'),
  })
  .superRefine((config, ctx) => {
    if (config.GITHUB_AUTH_ENABLED === 'true') {
      for (const key of requiredForGithubAuth) {
        if (!config[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when GITHUB_AUTH_ENABLED=true`,
          });
        }
      }
    }

    if (config.NODE_ENV === 'production') {
      for (const key of requiredInProduction) {
        if (!config[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required in production`,
          });
        }
      }
    }

    if (deployedEnvironments.has(config.NODE_ENV)) {
      if (!config.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: `DATABASE_URL is required in ${config.NODE_ENV}`,
        });
      }

      if (config.DATABASE_URL && !hasPrismaPooler(config.DATABASE_URL)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message:
            'DATABASE_URL must include connection_limit=5 or pgbouncer=true in staging/production',
        });
      }
    }

    if (
      config.NODE_ENV === 'production' &&
      config.CORS_ORIGINS?.includes('*')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS must not use wildcards in production',
      });
    }

    if (config.NODE_ENV === 'production' && !config.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
