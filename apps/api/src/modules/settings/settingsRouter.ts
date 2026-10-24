import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { logAudit } from '../../middleware/auditHelper.js';

import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

// Allowed configurable store settings keys
const ALLOWED_SETTING_KEYS = [
  'shop_name',
  'shop_address',
  'shop_phone',
  'shop_vat_no',
  'receipt_footer',
  'currency_code',
  'currency_symbol',
  'default_tax_rate',
  'low_stock_threshold',
  'allow_negative_stock',
  'enable_sms_receipt',
] as const;

const settingsUpdateSchema = z.record(
  z.string().refine((k) => (ALLOWED_SETTING_KEYS as readonly string[]).includes(k), {
    message: 'Invalid or unauthorized configuration key',
  }),
  z.string().max(500, 'Setting value is too long')
);

// GET /api/v1/settings - Get all store settings
settingsRouter.get('/', requireAuth, requirePermission('settings.view'), async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.query<any>('SELECT * FROM settings');
    const settingsMap: Record<string, string> = {};
    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    res.json({
      data: settingsMap,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/settings - Update settings (Admin or settings:write permission required)
settingsRouter.put('/', requireAuth, requirePermission('settings:write'), async (req, res, next) => {
  try {
    // Only superadmin can modify system configuration
    if (req.user!.roleName !== 'admin') {
      throw new AppError('Unauthorized: Only administrators can update store configuration.', 403, 'FORBIDDEN');
    }

    const parsed = settingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const updates = parsed.data;
    const db = getDb();

    for (const [key, value] of Object.entries(updates)) {
      await db.execute(
        `INSERT INTO settings (id, key, value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [`set-${key}`, key, String(value)]
      );
    }

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'STORE_SETTINGS_UPDATE',
      entityType: 'settings',
      ipAddress: req.ip,
      changeSummary: 'Updated store configuration settings',
      details: updates,
    });

    res.json({
      data: { message: 'Settings saved successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
