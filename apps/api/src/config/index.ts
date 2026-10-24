import dotenv from 'dotenv';
dotenv.config();

// Enforce that JWT_SECRET is configured in production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'development-in-memory-fallback-key-32ch'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  dbPath: process.env.DB_PATH || 'pos_data.db',
  currency: {
    code: process.env.CURRENCY_CODE || 'BDT',
    symbol: process.env.CURRENCY_SYMBOL || '৳',
    decimalScale: parseInt(process.env.CURRENCY_DECIMAL_SCALE || '2', 10),
  },
  shop: {
    name: process.env.SHOP_NAME || 'SuperMart Enterprise POS',
    address: process.env.SHOP_ADDRESS || 'Plot 42, Gulshan Avenue, Dhaka, Bangladesh',
    phone: process.env.SHOP_PHONE || '+880 1712-345678',
    vatNumber: process.env.SHOP_VAT_NO || 'BIN-9876543210',
    receiptFooter: process.env.RECEIPT_FOOTER || 'Thank you for shopping with us! Please come again.',
    timezone: process.env.SHOP_TIMEZONE || 'Asia/Dhaka',
    defaultTaxRate: parseFloat(process.env.DEFAULT_TAX_RATE || '5.0'),
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

// Fail fast if JWT_SECRET is invalid in production
if (config.env === 'production' && (!config.jwtSecret || config.jwtSecret.trim().length < 32)) {
  throw new Error('JWT_SECRET required in production and must be at least 32 characters');
}

// Centralized single source of truth for JWT secret - no hardcoded secret fallback
export function getJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || config.jwtSecret || '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET must be set in environment');
  }
  if (config.env === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET required in production and must be at least 32 characters');
  }
  return secret;
}

// Centralized CORS allowed origins
export const corsAllowedOrigins: string[] = (
  process.env.CORS_ALLOWED_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://pos-p4o6.onrender.com'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export function isOriginAllowed(origin: string): boolean {
  if (!origin) return true;
  if (
    corsAllowedOrigins.includes(origin) ||
    origin.endsWith('.onrender.com') ||
    origin.startsWith('http://localhost:')
  ) {
    return true;
  }
  return false;
}

// Centralized rate limit configuration
export const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
};
