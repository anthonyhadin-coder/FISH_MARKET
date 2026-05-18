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
  const requiredVars = process.env.NODE_ENV === 'production'
    ? REQUIRED_ENV_VARS
    : REQUIRED_ENV_VARS.filter(key => key !== 'REDIS_URL');

  const missing = requiredVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('Copy .env.example to .env and fill in all values.');
    process.exit(1);
  }
  console.log('✅ Environment variables validated');
}
