import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const settingsRouter = Router();

// GET /api/v1/settings - Get all store settings
settingsRouter.get('/', requireAuth, requirePermission('settings:manage'), async (req, res, next) => {
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

// PUT /api/v1/settings - Update settings
settingsRouter.put('/', requireAuth, requirePermission('settings:manage'), async (req, res, next) => {
  try {
    const db = getDb();
    const updates = req.body as Record<string, string>;

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
