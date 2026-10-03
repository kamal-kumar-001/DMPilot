import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/autodm?schema=public'),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(8).default('supersecret_change_me_in_production_12345678'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // SMTP Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('AutoDM <noreply@autodm.com>'),
  RESEND_API_KEY: z.string().optional(),

  // Encryption Configuration
  ENCRYPTION_KEY: z.string().min(16).default('supersecret_encryption_key_change_me_in_production'),

  // Meta Instagram Configuration
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().default('http://localhost:4000/instagram/callback'),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default('autodm_verify_token_12345'),
});

export type Env = z.infer<typeof envSchema>;
