import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Product, Category, Unit } from '../../types';
import {
  Package,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Plus,
  SlidersHorizontal,
  Download,
  Search,
  CheckCircle,
  FileText,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'balances' | 'ledger'>('balances');
  const [overview, setOverview] = useState<any>(null);
  const [balances, setBalances] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [loading, setLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<any>(null);

  // Form states
  const [newProd, setNewProd] = useState({
    name: '',
    categoryId: '',
    unitId: '',
    sku: '',
    barcode: '',
    costPrice: 0,
    sellingPrice: 0,
    minStockThreshold: 5,
    maxStockThreshold: 100,
    initialStock: 10,
    description: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    type: 'ADJUSTMENT_DAMAGE' as 'ADJUSTMENT_DAMAGE' | 'ADJUSTMENT_LOSS' | 'ADJUSTMENT_FOUND' | 'ADJUSTMENT_CORRECTION',
    quantity: 1,
    reason: '',
  });

  useEffect(() => {
    loadOverview();
    loadBalances();
    loadCategoriesAndUnits();
    if (activeTab === 'ledger') loadMovements();
  }, [activeTab, filter]);

  const loadOverview = async () => {
    try {
      const data = await apiRequest('/inventory/overview');
      setOverview(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBalances = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<any[]>(`/inventory/balances?filter=${filter}&search=${encodeURIComponent(search)}`);
      setBalances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      const data = await apiRequest<any[]>('/inventory/movements?limit=100');
      setMovements(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCategoriesAndUnits = async () => {
    try {
      const cats = await apiRequest<Category[]>('/categories');
      const u = await apiRequest<Unit[]>('/units');
      setCategories(cats);
      setUnits(u);
      if (cats.length > 0) setNewProd((prev) => ({ ...prev, categoryId: cats[0].id }));
      if (u.length > 0) setNewProd((prev) => ({ ...prev, unitId: u[0].id }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(newProd),
      });
      setShowAddModal(false);
      loadBalances();
      loadOverview();
      alert('Product created and opening stock recorded in ledger.');
    } catch (err: any) {
      alert(err.message || 'Failed to create product');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust) return;

    try {
      await apiRequest('/inventory/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductForAdjust.productId,
          type: adjustForm.type,
          quantity: adjustForm.quantity,
          reason: adjustForm.reason,
        }),
      });
      setShowAdjustModal(false);
      setSelectedProductForAdjust(null);
      setAdjustForm({ type: 'ADJUSTMENT_DAMAGE', quantity: 1, reason: '' });
      loadBalances();
      loadOverview();
      alert('Stock adjustment applied and recorded in audit ledger.');
    } catch (err: any) {
      alert(err.message || 'Adjustment failed');
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (balances.length === 0) return;
    const headers = ['Product Name', 'SKU', 'Barcode', 'Category', 'Current Stock', 'Unit', 'Cost Price', 'Selling Price', 'Cost Valuation', 'Retail Valuation', 'Status'];
    const rows = balances.map((b) => [
      `"${b.productName}"`,
      `"${b.sku}"`,
      `"${b.barcode}"`,
      `"${b.categoryName}"`,
      b.currentStock,
      `"${b.unit}"`,
      b.costPrice,
      b.sellingPrice,
      b.costValue,
      b.retailValue,
      b.stockStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = overview?.summary || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Inventory At A Glance</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Real-time stock valuation, reorder thresholds, and append-only movement ledger
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={exportToCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* KPI Cards Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            padding: '18px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>TOTAL COST VALUATION</span>
            <TrendingUp size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            ৳{(summary.totalCostValuation || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Retail: ৳{(summary.totalRetailValuation || 0).toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            padding: '18px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>STOCK UNITS ON HAND</span>
            <Package size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>
            {(summary.totalUnits || 0).toLocaleString()} pcs
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across {summary.totalProducts || 0} active SKU items
          </div>
        </div>

        <div
          onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
          style={{
            background: filter === 'low' ? 'var(--warning-light)' : 'var(--bg-card)',
            padding: '18px',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${filter === 'low' ? 'var(--warning)' : 'var(--border)'}`,
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>LOW STOCK ALERTS</span>
            <AlertTriangle size={18} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--warning)' }}>
            {summary.lowStockCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Items at or below reorder threshold
          </div>
        </div>

        <div
          onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}
          style={{
            background: filter === 'out' ? 'var(--danger-light)' : 'var(--bg-card)',
            padding: '18px',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${filter === 'out' ? 'var(--danger)' : 'var(--border)'}`,
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>OUT OF STOCK</span>
            <XCircle size={18} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--danger)' }}>
            {summary.outOfStockCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Items depleted to 0 units
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}>
        <button
          className={`btn ${activeTab === 'balances' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('balances')}
          style={{ borderRadius: '8px 8px 0 0', padding: '10px 18px' }}
        >
          <Package size={16} /> Current Stock Balances
        </button>
        <button
          className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ledger')}
          style={{ borderRadius: '8px 8px 0 0', padding: '10px 18px' }}
        >
          <FileText size={16} /> Stock Movements Ledger (Audit)
        </button>
      </div>

      {/* TAB 1: Stock Balances Table */}
      {activeTab === 'balances' && (
        <div className="table-container">
          <div className="table-header-bar">
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div className="search-input-wrap" style={{ width: '280px' }}>
                <Search size={16} className="search-icon-pos" />
                <input
                  type="text"
                  placeholder="Filter by name, barcode or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadBalances()}
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              >
                <option value="all">All Items</option>
                <option value="low">Low Stock Only</option>
                <option value="out">Out of Stock Only</option>
              </select>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Showing {balances.length} items
            </div>
          </div>

          <table className="pos-table">
            <thead>
              <tr>
                <th>Product / SKU</th>
                <th>Category</th>
                <th>Barcode</th>
                <th>Cost (৳)</th>
                <th>Selling (৳)</th>
                <th>Stock on Hand</th>
                <th>Cost Value (৳)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.productId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.productName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.sku}</div>
                  </td>
                  <td>{b.categoryName}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{b.barcode}</span>
                  </td>
                  <td>৳{b.costPrice.toFixed(2)}</td>
                  <td style={{ fontWeight: 600 }}>৳{b.sellingPrice.toFixed(2)}</td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{b.currentStock}</span> {b.unit}
                  </td>
                  <td>৳{b.costValue.toFixed(2)}</td>
                  <td>
                    <span
                      className={`stock-tag ${
                        b.stockStatus === 'OUT_OF_STOCK' ? 'out' : b.stockStatus === 'LOW_STOCK' ? 'low' : 'in'
                      }`}
                    >
                      {b.stockStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                      onClick={() => {
                        setSelectedProductForAdjust(b);
                        setShowAdjustModal(true);
                      }}
                    >
                      <SlidersHorizontal size={14} /> Adjust Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Movements Ledger Table */}
      {activeTab === 'ledger' && (
        <div className="table-container">
          <div className="table-header-bar">
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Immutable Stock Movement Ledger</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing last 100 historical records
            </span>
          </div>

          <table className="pos-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Cost Basis</th>
                <th>Reference</th>
                <th>Notes / Reason</th>
                <th>Initiator</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.productName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.barcode}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor:
                          m.signedQuantity > 0 ? 'var(--success-light)' : 'var(--danger-light)',
                        color: m.signedQuantity > 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {m.movementType}
                    </span>
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: m.signedQuantity > 0 ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {m.signedQuantity > 0 ? `+${m.signedQuantity}` : m.signedQuantity}
                  </td>
                  <td>৳{m.costPrice.toFixed(2)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{m.referenceId || 'N/A'}</td>
                  <td>{m.notes}</td>
                  <td>{m.createdBy || 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Add New Catalog Product</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Product Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={newProd.name}
                    onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                    placeholder="e.g. Dano Milk Powder 500g"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Category:
                    </label>
                    <select
                      value={newProd.categoryId}
                      onChange={(e) => setNewProd({ ...newProd, categoryId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Unit:
                    </label>
                    <select
                      value={newProd.unitId}
                      onChange={(e) => setNewProd({ ...newProd, unitId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.short_name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      SKU Code:
                    </label>
                    <input
                      type="text"
                      required
                      value={newProd.sku}
                      onChange={(e) => setNewProd({ ...newProd, sku: e.target.value.toUpperCase() })}
                      placeholder="e.g. DAI-DANO500"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Barcode:
                    </label>
                    <input
                      type="text"
                      required
                      value={newProd.barcode}
                      onChange={(e) => setNewProd({ ...newProd, barcode: e.target.value })}
                      placeholder="e.g. 89411001099"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Cost Price (৳):
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newProd.costPrice || ''}
                      onChange={(e) => setNewProd({ ...newProd, costPrice: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Selling Price (৳):
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newProd.sellingPrice || ''}
                      onChange={(e) => setNewProd({ ...newProd, sellingPrice: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Opening Stock:
                    </label>
                    <input
                      type="number"
                      value={newProd.initialStock || ''}
                      onChange={(e) => setNewProd({ ...newProd, initialStock: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Min Threshold:
                    </label>
                    <input
                      type="number"
                      value={newProd.minStockThreshold}
                      onChange={(e) => setNewProd({ ...newProd, minStockThreshold: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product & Post Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedProductForAdjust && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Adjust Stock Quantity</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustStock}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700 }}>{selectedProductForAdjust.productName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Current Available Stock: <strong>{selectedProductForAdjust.currentStock} units</strong>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Adjustment Type:
                  </label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <option value="ADJUSTMENT_DAMAGE">Damage Write-off (-)</option>
                    <option value="ADJUSTMENT_LOSS">Inventory Loss / Theft (-)</option>
                    <option value="ADJUSTMENT_FOUND">Found Extra Stock (+)</option>
                    <option value="ADJUSTMENT_CORRECTION">Physical Stock Count Correction</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Units Quantity:
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 1 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Reason (Mandatory Audit Trail):
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide reason for this adjustment..."
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Post Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
