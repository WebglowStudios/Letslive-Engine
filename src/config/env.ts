import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;

  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    console.warn(`Warning: Environment variable ${key} is not set`);
    return '';
  }

  return value;
};

export const env = {
  PORT: parseInt(getEnv('PORT', '5000'), 10),
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  MONGODB_URI: getEnv('MONGODB_URI', 'mongodb://localhost:27017/letslivetours'),
  JWT_SECRET: getEnv('JWT_SECRET', 'dev-secret'),
  JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  JWT_EXPIRE: getEnv('JWT_EXPIRE', '15m'),
  JWT_REFRESH_EXPIRE: getEnv('JWT_REFRESH_EXPIRE', '7d'),
  FRONTEND_URL: getEnv('FRONTEND_URL', 'http://localhost:3000'),
  SMTP_HOST: getEnv('SMTP_HOST', 'smtp.gmail.com'),
  SMTP_PORT: parseInt(getEnv('SMTP_PORT', '587'), 10),
  SMTP_USER: getEnv('SMTP_USER', ''),
  SMTP_PASS: getEnv('SMTP_PASS', ''),
  CLOUDINARY_CLOUD_NAME: getEnv('CLOUDINARY_CLOUD_NAME', ''),
  CLOUDINARY_API_KEY: getEnv('CLOUDINARY_API_KEY', ''),
  CLOUDINARY_API_SECRET: getEnv('CLOUDINARY_API_SECRET', ''),
} as const;

export default env;
