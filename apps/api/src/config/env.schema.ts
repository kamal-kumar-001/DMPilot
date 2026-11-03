import { z } from 'zod';

// Development-only fallbacks. In production these committed defaults are rejected
// at boot (see superRefine below) so a missing env var can never silently ship an
// insecure known value.
const DEV_JWT_SECRET = 'dmpilot_dev_only_jwt_secret_change_me_0123456789';
const DEV_ENCRYPTION_KEY = 'dmpilot_dev_only_encryption_key_change_me';
const DEV_META_WEBHOOK_VERIFY_TOKEN = 'dmpilot_dev_only_verify_token_change_me';
const DEV_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/dmpilot?schema=public';

export const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url().default(DEV_DATABASE_URL),
    REDIS_URL: z.string().url().optional(),
    JWT_SECRET: z.string().min(8).default(DEV_JWT_SECRET),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),

    // Comma-separated CORS allowlist. Falls back to FRONTEND_URL when unset.
    CORS_ORIGINS: z.string().optional(),

    // SMTP Configuration
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().default('DMPilot <no-reply@dmpilot.org>'),
    RESEND_API_KEY: z.string().optional(),

    // Email Routing & Custom Addresses
    MAIL_DOMAIN: z.string().default('dmpilot.org'),
    SUPPORT_EMAIL: z.string().optional(),
    SMTP_FROM_NOREPLY: z.string().optional(),
    SMTP_FROM_BILLING: z.string().optional(),
    SMTP_FROM_ALERTS: z.string().optional(),
    // Accepted alternate names for the same three senders
    SMTP_FROM_NO_REPLY: z.string().optional(),
    SMTP_FROM_RECEIPTS: z.string().optional(),
    SMTP_FROM_RECEIPT: z.string().optional(),
    SMTP_FROM_NOTIFICATIONS: z.string().optional(),

    // Encryption Configuration
    ENCRYPTION_KEY: z.string().min(16).default(DEV_ENCRYPTION_KEY),

    // Meta Instagram Configuration
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    INSTAGRAM_APP_ID: z.string().optional(),
    INSTAGRAM_APP_SECRET: z.string().optional(),
    META_REDIRECT_URI: z.string().default('http://localhost:4000/instagram/callback'),
    META_WEBHOOK_VERIFY_TOKEN: z.string().default(DEV_META_WEBHOOK_VERIFY_TOKEN),

    // Billing / Payment Providers
    BILLING_PROVIDER: z.enum(['razorpay', 'feefree']).default('razorpay'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    // Mock checkout self-grants paid plans without payment; never honored in production.
    ALLOW_MOCK_CHECKOUT: z.enum(['true', 'false']).default('false'),

    // FeeFree (UPI payment detection) provider configuration
    FEEFREE_API_URL: z.string().url().default('http://localhost:6100'),
    FEEFREE_API_KEY: z.string().optional(),
    FEEFREE_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    const committedDefaults: Array<[keyof typeof env, string]> = [
      ['JWT_SECRET', DEV_JWT_SECRET],
      ['ENCRYPTION_KEY', DEV_ENCRYPTION_KEY],
      ['META_WEBHOOK_VERIFY_TOKEN', DEV_META_WEBHOOK_VERIFY_TOKEN],
      ['DATABASE_URL', DEV_DATABASE_URL],
    ];
    for (const [key, devDefault] of committedDefaults) {
      if (env[key] === devDefault) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be set to a strong unique value in production; the committed development default is not allowed.`,
        });
      }
    }

    if (env.BILLING_PROVIDER === 'feefree') {
      for (const key of ['FEEFREE_API_KEY', 'FEEFREE_WEBHOOK_SECRET'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required in production when BILLING_PROVIDER=feefree.`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
