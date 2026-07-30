import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '4000')),
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: required('DATABASE_URL'),

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTokenTtl: optional('ACCESS_TOKEN_TTL', '15m'),
  refreshTokenTtl: optional('REFRESH_TOKEN_TTL', '30d'),

  fieldEncryptionKey: optional(
    'FIELD_ENCRYPTION_KEY',
    '0'.repeat(64),
  ),

  providerMode: optional('PROVIDER_MODE', 'sandbox') as 'sandbox' | 'live',

  // MTN MoMo Open API. Only read when PROVIDER_MODE=live; the defaults point at
  // MTN's sandbox host, so nothing here can reach production by accident.
  // Credentials are not `required()` - a missing one degrades that single channel
  // to the sandbox stub rather than stopping the server from booting.
  momo: {
    baseUrl: optional('MOMO_BASE_URL', 'https://sandbox.momodeveloper.mtn.com'),
    subscriptionKey: optional('MOMO_SUBSCRIPTION_KEY', ''),
    apiUser: optional('MOMO_API_USER', ''),
    apiKey: optional('MOMO_API_KEY', ''),
    targetEnvironment: optional('MOMO_TARGET_ENVIRONMENT', 'sandbox'),
    callbackHost: optional('MOMO_CALLBACK_HOST', 'example.com'),
    timeoutMs: Number(optional('MOMO_TIMEOUT_MS', '10000')),
  },
} as const;

export const isProd = env.nodeEnv === 'production';

// The placeholder key is fine for local work - it keeps `npm run dev` running
// without ceremony. In production it would encrypt every MoMo number with a key
// that is committed to the repo, which is the same as not encrypting them. Fail
// at boot rather than silently, because nothing downstream can detect it.
if (isProd && env.fieldEncryptionKey === '0'.repeat(64)) {
  throw new Error(
    'FIELD_ENCRYPTION_KEY is still the all-zero placeholder. Generate one with:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      'Keep a copy - if it is lost, encrypted fields cannot be recovered.',
  );
}
