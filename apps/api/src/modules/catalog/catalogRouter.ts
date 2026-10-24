import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';
import { CatalogRepository } from '../../db/repositories/CatalogRepository.js';

export const catalogRouter = Router();

// GET /api/v1/products - List / Search products
catalogRouter.get('/products', requireAuth, async (req, res, next) => {
  try {
    const search = ((req.query.search as string) || '').trim();
    const categoryId = req.query.categoryId as string;
    const stockStatus = req.query.stockStatus as string;
    const branchId = req.user!.branchId;

    const products = await CatalogRepository.getProducts({
      branchId,
      search,
      categoryId,
      stockStatus,
    });

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
    const branchId = req.user!.branchId;
    const isSuperAdmin = req.user!.roleName === 'admin';
    const product = await CatalogRepository.getProductById(req.params.id, branchId, isSuperAdmin);

    if (!product) {
      throw new AppError('Product not found in this branch or access denied', 404, 'NOT_FOUND');
    }

    res.json({
      data: product,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const productSchema = z.object({
  name: z.string().trim().min(2, 'Name must have at least 2 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  unitId: z.string().min(1, 'Unit is required'),
  sku: z.string().trim().min(2, 'SKU is required'),
  barcode: z.string().trim().min(2, 'Barcode is required'),
  costPrice: z.number().min(0, 'Cost price cannot be negative'),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
  minStockThreshold: z.number().default(5),
  maxStockThreshold: z.number().default(100),
  taxRate: z.number().default(5.0),
  initialStock: z.number().optional().default(0),
  description: z.string().optional().default(''),
});

const updateProductSchema = z.object({
  name: z.string().trim().min(2, 'Name must have at least 2 characters').optional(),
  categoryId: z.string().min(1, 'Category is required').optional(),
  unitId: z.string().min(1, 'Unit is required').optional(),
  sku: z.string().trim().min(2, 'SKU is required').optional(),
  barcode: z.string().trim().min(2, 'Barcode is required').optional(),
  costPrice: z.number().min(0, 'Cost price cannot be negative').optional(),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative').optional(),
  minStockThreshold: z.number().min(0).optional(),
  maxStockThreshold: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
  description: z.string().optional(),
});

// POST /api/v1/products - Create product (Guarded by requirePermission('catalog.manage'))
catalogRouter.post('/products', requireAuth, requirePermission('catalog.manage'), async (req, res, next) => {
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

// PUT /api/v1/products/:id - Update product (Guarded by requirePermission('catalog.manage'))
catalogRouter.put('/products/:id', requireAuth, requirePermission('catalog.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const db = getDb();
    const branchId = req.user!.branchId;
    const existing = await db.query<any>('SELECT * FROM products WHERE id = ? AND branch_id = ?', [id, branchId]);
    if (existing.length === 0) {
      throw new AppError('Product not found in this branch or access denied', 404, 'NOT_FOUND');
    }

    const { name, categoryId, unitId, sku, barcode, costPrice, sellingPrice, minStockThreshold, maxStockThreshold, taxRate, isActive, description } = parsed.data;

    // Check duplicate barcode or SKU if changed
    if (sku && sku !== existing[0].sku) {
      const dupSku = await db.query<any>('SELECT id FROM products WHERE sku = ? AND branch_id = ? AND id != ?', [sku, branchId, id]);
      if (dupSku.length > 0) throw new AppError('SKU already exists in this branch', 409, 'DUPLICATE_SKU');
    }

    if (barcode && barcode !== existing[0].barcode) {
      const dupBar = await db.query<any>('SELECT id FROM products WHERE barcode = ? AND branch_id = ? AND id != ?', [barcode, branchId, id]);
      if (dupBar.length > 0) throw new AppError('Barcode already exists in this branch', 409, 'DUPLICATE_BARCODE');
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
       WHERE id = ? AND branch_id = ?`,
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
        branchId,
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

// DELETE /api/v1/products/:id - Delete product (Guarded by requirePermission('catalog.manage'))
catalogRouter.delete('/products/:id', requireAuth, requirePermission('catalog.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;
    const db = getDb();

    const existing = await db.query<any>('SELECT id, name FROM products WHERE id = ? AND branch_id = ?', [id, branchId]);
    if (existing.length === 0) {
      throw new AppError('Product not found in this branch or access denied', 404, 'NOT_FOUND');
    }

    await CatalogRepository.deleteProduct(id, branchId);

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'CATALOG_DELETE_PRODUCT',
      entityType: 'product',
      entityId: id,
      ipAddress: req.ip,
      changeSummary: `Deleted product ${existing[0].name} (${id})`,
    });

    res.json({
      data: { message: 'Product deleted successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/categories - List categories
catalogRouter.get('/categories', requireAuth, async (req, res, next) => {
  try {
    const categories = await CatalogRepository.getCategories();
    res.json({
      data: categories,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must have at least 2 characters').max(50),
  code: z.string().trim().min(2, 'Category code must have at least 2 characters').max(20),
  description: z.string().optional().default(''),
});

// POST /api/v1/categories - Create category (Guarded by requirePermission('catalog.manage'))
catalogRouter.post('/categories', requireAuth, requirePermission('catalog.manage'), async (req, res, next) => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { name, code, description } = parsed.data;
    const db = getDb();

    // Check duplicate name or code
    const dup = await db.query<any>(
      'SELECT id, name, code FROM categories WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)',
      [name, code]
    );

    if (dup.length > 0) {
      if (dup[0].code.toUpperCase() === code.toUpperCase()) {
        throw new AppError(`A category with code "${code}" already exists.`, 409, 'DUPLICATE_CATEGORY_CODE');
      }
      throw new AppError(`A category with name "${name}" already exists.`, 409, 'DUPLICATE_CATEGORY_NAME');
    }

    const catId = `cat-${Date.now()}`;
    await db.execute(
      `INSERT INTO categories (id, name, code, description, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [catId, name, code.toUpperCase(), description || '']
    );

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'CATALOG_CREATE_CATEGORY',
      entityType: 'category',
      entityId: catId,
      ipAddress: req.ip,
      changeSummary: `Created category ${name} (${code.toUpperCase()})`,
    });

    res.status(201).json({
      data: { id: catId, message: 'Category created successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/units - List units
catalogRouter.get('/units', requireAuth, async (req, res, next) => {
  try {
    const units = await CatalogRepository.getUnits();
    res.json({
      data: units,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
