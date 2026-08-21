const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'CLIENT_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

export function validateEnv() {
  const alwaysRequired = REQUIRED_ENV_VARS.filter(key => key !== 'REDIS_URL');
  const missing = alwaysRequired.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('Copy .env.example to .env and fill in all values.');
    process.exit(1);
  }

  // Warn (not fail) if REDIS_URL is missing — denylist and rate-limiting will degrade
  if (!process.env.REDIS_URL) {
    const level = process.env.NODE_ENV === 'production' ? 'error' : 'warn';
    console[level](
      `⚠️  REDIS_URL is not set. Token denylist and distributed rate limiting are DISABLED. ` +
      `This is acceptable in local dev but MUST be set in production.`
    );
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }

  console.log('✅ Environment variables validated');
}
