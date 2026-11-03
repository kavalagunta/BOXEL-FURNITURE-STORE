import { z } from 'zod';
import { query, queryOne, withTransaction } from '../../config/db.js';
import { logActivity } from '../../services/activityLog.js';
import { formatE164 } from '../../services/whatsappService.js';
import { text, optionalText, email as emailValidator, boolish } from '../../utils/validators.js';
import { badRequest, notFound, conflict } from '../../utils/httpError.js';

export const vendorSchema = z.object({
  name: text(120, 2),
  whatsapp_number: z.string().trim().min(8, 'Enter a valid WhatsApp phone number.').max(30),
  email: z.union([emailValidator, z.literal(''), z.null()]).optional().transform((v) => v || null),
  is_active: boolish.default(true),
});

export const assignProductsSchema = z.object({
  productIds: z.array(z.coerce.number().int().positive()).default([]),
});

/** List all delivery vendors with assigned products count */
export async function list(req, res) {
  const vendors = await query(`
    SELECT v.id, v.name, v.whatsapp_number, v.email, v.is_active, v.created_at, v.updated_at,
           COUNT(p.id) AS product_count
    FROM vendors v
    LEFT JOIN products p ON p.vendor_id = v.id
    GROUP BY v.id
    ORDER BY v.id DESC
  `);
  res.json({ items: vendors });
}

/** Get a single vendor and their assigned products */
export async function get(req, res) {
  const id = Number(req.params.id);
  const vendor = await queryOne('SELECT * FROM vendors WHERE id = ?', [id]);
  if (!vendor) throw notFound('Vendor not found.');

  const products = await query(
    'SELECT id, name, sku, price, status, is_featured FROM products WHERE vendor_id = ? ORDER BY name ASC',
    [id],
  );

  res.json({ vendor, products });
}

/** Create a new delivery vendor */
export async function create(req, res) {
  const d = req.valid.body;
  const formattedPhone = formatE164(d.whatsapp_number);
  if (!formattedPhone || formattedPhone.length < 10) {
    throw badRequest('Please enter a valid phone number (e.g. +91XXXXXXXXXX or 10 digits).');
  }

  const result = await query(
    'INSERT INTO vendors (name, whatsapp_number, email, is_active) VALUES (?, ?, ?, ?)',
    [d.name, formattedPhone, d.email, d.is_active ? 1 : 0],
  );

  const newVendor = await queryOne('SELECT * FROM vendors WHERE id = ?', [result.insertId]);
  await logActivity(req, 'vendor.create', 'vendor', result.insertId, { name: d.name });
  res.status(201).json({ ok: true, vendor: newVendor });
}

/** Update an existing delivery vendor */
export async function update(req, res) {
  const id = Number(req.params.id);
  const exists = await queryOne('SELECT id FROM vendors WHERE id = ?', [id]);
  if (!exists) throw notFound('Vendor not found.');

  const d = req.valid.body;
  const formattedPhone = formatE164(d.whatsapp_number);
  if (!formattedPhone || formattedPhone.length < 10) {
    throw badRequest('Please enter a valid phone number (e.g. +91XXXXXXXXXX or 10 digits).');
  }

  await query(
    'UPDATE vendors SET name = ?, whatsapp_number = ?, email = ?, is_active = ? WHERE id = ?',
    [d.name, formattedPhone, d.email, d.is_active ? 1 : 0, id],
  );

  const updated = await queryOne('SELECT * FROM vendors WHERE id = ?', [id]);
  await logActivity(req, 'vendor.update', 'vendor', id, { name: d.name });
  res.json({ ok: true, vendor: updated });
}

/** Remove a vendor (unassigns products to null rather than deleting products) */
export async function remove(req, res) {
  const id = Number(req.params.id);
  const exists = await queryOne('SELECT id, name FROM vendors WHERE id = ?', [id]);
  if (!exists) throw notFound('Vendor not found.');

  await withTransaction(async (conn) => {
    await conn.query('UPDATE products SET vendor_id = NULL WHERE vendor_id = ?', [id]);
    await conn.query('DELETE FROM vendors WHERE id = ?', [id]);
  });

  await logActivity(req, 'vendor.delete', 'vendor', id, { name: exists.name });
  res.json({ ok: true });
}

/** Assign a list of product IDs to this vendor */
export async function assignProducts(req, res) {
  const id = Number(req.params.id);
  const exists = await queryOne('SELECT id, name FROM vendors WHERE id = ?', [id]);
  if (!exists) throw notFound('Vendor not found.');

  const { productIds } = req.valid.body;

  await withTransaction(async (conn) => {
    // 1. Unassign products currently assigned to this vendor that are not in the new list
    if (productIds.length > 0) {
      await conn.query('UPDATE products SET vendor_id = NULL WHERE vendor_id = ? AND id NOT IN (?)', [id, productIds]);
      await conn.query('UPDATE products SET vendor_id = ? WHERE id IN (?)', [id, productIds]);
    } else {
      await conn.query('UPDATE products SET vendor_id = NULL WHERE vendor_id = ?', [id]);
    }
  });

  await logActivity(req, 'vendor.assign_products', 'vendor', id, { productCount: productIds.length });
  res.json({ ok: true, assignedCount: productIds.length });
}

/** Get all products to allow assigning to vendors */
export async function getProducts(req, res) {
  const items = await query(`
    SELECT p.id, p.name, p.sku, p.price, p.status, p.vendor_id, v.name AS vendor_name
    FROM products p
    LEFT JOIN vendors v ON v.id = p.vendor_id
    ORDER BY p.name ASC
  `);
  res.json({ items });
}

