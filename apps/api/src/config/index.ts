import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'pos-enterprise-super-secure-jwt-secret-key-vibe96-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  dbPath: process.env.DB_PATH || 'pos_data.db',
  currency: {
    code: process.env.CURRENCY_CODE || 'BDT',
    symbol: process.env.CURRENCY_SYMBOL || '৳',
    decimalScale: 2,
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
