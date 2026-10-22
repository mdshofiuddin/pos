import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const catalogRouter = Router();

// GET /api/v1/products - List / Search products
catalogRouter.get('/products', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const search = ((req.query.search as string) || '').trim();
    const categoryId = req.query.categoryId as string;
    const stockStatus = req.query.stockStatus as string; // 'low', 'out', 'all'
    const branchId = req.user!.branchId;

    let sql = `
      SELECT p.id, p.branch_id as branchId, p.category_id as categoryId, c.name as categoryName,
             p.unit_id as unitId, u.short_name as unitName, p.sku, p.barcode, p.name,
             p.description, p.cost_price as costPrice, p.selling_price as sellingPrice,
             p.min_stock_threshold as minStockThreshold, p.max_stock_threshold as maxStockThreshold,
             p.tax_rate as taxRate, p.is_active as isActive,
             COALESCE(sb.current_stock, 0) as currentStock
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN units u ON p.unit_id = u.id
      LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = ?
      WHERE p.branch_id = ?
    `;

    const params: any[] = [branchId, branchId];

    if (search) {
      sql += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (categoryId) {
      sql += ` AND p.category_id = ?`;
      params.push(categoryId);
    }

    if (stockStatus === 'low') {
      sql += ` AND COALESCE(sb.current_stock, 0) <= p.min_stock_threshold AND COALESCE(sb.current_stock, 0) > 0`;
    } else if (stockStatus === 'out') {
      sql += ` AND COALESCE(sb.current_stock, 0) <= 0`;
    }

    sql += ` ORDER BY p.name ASC`;

    const products = await db.query<any>(sql, params);

    res.json({
      data: products,
      meta: {
        total: products.length,
        requestId: crypto.randomUUID(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products/:id - Single product
catalogRouter.get('/products/:id', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const products = await db.query<any>(
      `SELECT p.*, c.name as categoryName, u.short_name as unitName,
              COALESCE(sb.current_stock, 0) as currentStock
       FROM products p
       JOIN categories c ON p.category_id = c.id
       JOIN units u ON p.unit_id = u.id
       LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = p.branch_id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (products.length === 0) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    res.json({
      data: products[0],
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const productSchema = z.object({
  name: z.string().min(2, 'Name must have at least 2 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  unitId: z.string().min(1, 'Unit is required'),
  sku: z.string().min(2, 'SKU is required'),
  barcode: z.string().min(2, 'Barcode is required'),
  costPrice: z.number().min(0, 'Cost price cannot be negative'),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
  minStockThreshold: z.number().default(5),
  maxStockThreshold: z.number().default(100),
  taxRate: z.number().default(5.0),
  initialStock: z.number().optional().default(0),
  description: z.string().optional().default(''),
});

// POST /api/v1/products - Create product
catalogRouter.post('/products', requireAuth, requirePermission('catalog:write'), async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const data = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;

    // Check SKU & Barcode uniqueness
    const duplicate = await db.query<any>(
      'SELECT id, sku, barcode FROM products WHERE sku = ? OR barcode = ?',
      [data.sku, data.barcode]
    );

    if (duplicate.length > 0) {
      if (duplicate[0].sku === data.sku) {
        throw new AppError(`A product with SKU "${data.sku}" already exists.`, 409, 'DUPLICATE_SKU');
      }
      throw new AppError(`A product with Barcode "${data.barcode}" already exists.`, 409, 'DUPLICATE_BARCODE');
    }

    const productId = `prd-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO products (id, branch_id, category_id, unit_id, sku, barcode, name, description, cost_price, selling_price, min_stock_threshold, max_stock_threshold, tax_rate, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          productId,
          branchId,
          data.categoryId,
          data.unitId,
          data.sku,
          data.barcode,
          data.name,
          data.description,
          data.costPrice,
          data.sellingPrice,
          data.minStockThreshold,
          data.maxStockThreshold,
          data.taxRate,
        ]
      );

      // Create stock balance
      await tx.execute(
        `INSERT INTO stock_balances (id, branch_id, product_id, current_stock, last_reconciled_at, version)
         VALUES (?, ?, ?, ?, datetime('now'), 1)`,
        [`sb-${productId}`, branchId, productId, data.initialStock]
      );

      // If initial stock provided, insert into stock movements
      if (data.initialStock > 0) {
        await tx.execute(
          `INSERT INTO stock_movements (id, branch_id, product_id, signed_quantity, movement_type, reference_type, reference_id, cost_price, notes, created_by)
           VALUES (?, ?, ?, ?, 'OPENING', 'manual_creation', ?, ?, 'Initial opening stock upon product creation', ?)`,
          [`sm-${Date.now()}`, branchId, productId, data.initialStock, productId, data.costPrice, req.user!.id]
        );
      }
    });

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'CATALOG_CREATE_PRODUCT',
      entityType: 'product',
      entityId: productId,
      ipAddress: req.ip,
      changeSummary: `Created product ${data.name} (SKU: ${data.sku}, Barcode: ${data.barcode})`,
      details: data,
    });

    res.status(201).json({
      data: { id: productId, message: 'Product created successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/products/:id - Update product
catalogRouter.put('/products/:id', requireAuth, requirePermission('catalog:write'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = await db.query<any>('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const { name, categoryId, unitId, sku, barcode, costPrice, sellingPrice, minStockThreshold, maxStockThreshold, taxRate, isActive, description } = req.body;

    // Check duplicate barcode or SKU if changed
    if (sku && sku !== existing[0].sku) {
      const dupSku = await db.query<any>('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, id]);
      if (dupSku.length > 0) throw new AppError('SKU already exists', 409, 'DUPLICATE_SKU');
    }

    if (barcode && barcode !== existing[0].barcode) {
      const dupBar = await db.query<any>('SELECT id FROM products WHERE barcode = ? AND id != ?', [barcode, id]);
      if (dupBar.length > 0) throw new AppError('Barcode already exists', 409, 'DUPLICATE_BARCODE');
    }

    await db.execute(
      `UPDATE products
       SET name = COALESCE(?, name),
           category_id = COALESCE(?, category_id),
           unit_id = COALESCE(?, unit_id),
           sku = COALESCE(?, sku),
           barcode = COALESCE(?, barcode),
           cost_price = COALESCE(?, cost_price),
           selling_price = COALESCE(?, selling_price),
           min_stock_threshold = COALESCE(?, min_stock_threshold),
           max_stock_threshold = COALESCE(?, max_stock_threshold),
           tax_rate = COALESCE(?, tax_rate),
           is_active = COALESCE(?, is_active),
           description = COALESCE(?, description),
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        name,
        categoryId,
        unitId,
        sku,
        barcode,
        costPrice,
        sellingPrice,
        minStockThreshold,
        maxStockThreshold,
        taxRate,
        isActive,
        description,
        id,
      ]
    );

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'CATALOG_UPDATE_PRODUCT',
      entityType: 'product',
      entityId: id,
      ipAddress: req.ip,
      changeSummary: `Updated product details for ${name || existing[0].name}`,
    });

    res.json({
      data: { message: 'Product updated successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/categories - List categories
catalogRouter.get('/categories', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const categories = await db.query<any>(
      `SELECT c.*, COUNT(p.id) as productCount
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id
       GROUP BY c.id
       ORDER BY c.name ASC`
    );

    res.json({
      data: categories,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/categories - Create category
catalogRouter.post('/categories', requireAuth, requirePermission('catalog:write'), async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      throw new AppError('Category name and code are required', 422, 'VALIDATION_ERROR');
    }

    const db = getDb();
    const catId = `cat-${Date.now()}`;
    await db.execute(
      `INSERT INTO categories (id, name, code, description, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [catId, name, code.toUpperCase(), description || '']
    );

    res.status(201).json({
      data: { id: catId, message: 'Category created' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/units - List units
catalogRouter.get('/units', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const units = await db.query<any>('SELECT * FROM units ORDER BY name ASC');
    res.json({
      data: units,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
