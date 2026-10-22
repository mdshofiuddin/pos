import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Supplier, Product } from '../../types';
import { Truck, Plus, ShoppingBag, FileText, Check } from 'lucide-react';

export const PurchasesView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');

  // Modals
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);

  // Forms
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    address: '',
  });

  const [purchaseForm, setPurchaseForm] = useState<{
    supplierId: string;
    items: Array<{ productId: string; quantity: number; unitCost: number }>;
    paidAmount: number;
    notes: string;
  }>({
    supplierId: '',
    items: [],
    paidAmount: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const sups = await apiRequest<Supplier[]>('/purchasing/suppliers');
      const pos = await apiRequest<any[]>('/purchasing/purchases');
      const prods = await apiRequest<Product[]>('/products');
      setSuppliers(sups);
      setPurchases(pos);
      setProducts(prods);

      if (sups.length > 0) {
        setPurchaseForm((prev) => ({
          ...prev,
          supplierId: sups[0].id,
          items: prods.length > 0 ? [{ productId: prods[0].id, quantity: 10, unitCost: prods[0].costPrice }] : [],
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/purchasing/suppliers', {
        method: 'POST',
        body: JSON.stringify(newSupplier),
      });
      setShowAddSupplierModal(false);
      setNewSupplier({ name: '', companyName: '', phone: '', email: '', address: '' });
      loadData();
      alert('Supplier registered successfully.');
    } catch (err: any) {
      alert(err.message || 'Creation failed');
    }
  };

  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseForm.items.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    try {
      await apiRequest('/purchasing/purchases', {
        method: 'POST',
        body: JSON.stringify(purchaseForm),
      });
      setShowNewPurchaseModal(false);
      loadData();
      alert('Goods receipt recorded. Inventory stock increased and supplier ledger updated.');
    } catch (err: any) {
      alert(err.message || 'Purchase recording failed');
    }
  };

  const addPurchaseLine = () => {
    if (products.length === 0) return;
    setPurchaseForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: products[0].id, quantity: 10, unitCost: products[0].costPrice }],
    }));
  };

  const removePurchaseLine = (idx: number) => {
    setPurchaseForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const calculatedTotal = purchaseForm.items.reduce((acc, it) => acc + it.quantity * it.unitCost, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Purchasing & Supplier Network</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Manage supplier accounts, record goods receipts, and track procurement payables
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowAddSupplierModal(true)}>
            <Plus size={16} /> Add Supplier
          </button>
          <button className="btn btn-primary" onClick={() => setShowNewPurchaseModal(true)}>
            <Truck size={16} /> Receive Goods (Purchase)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        <button
          className={`btn ${activeTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('purchases')}
          style={{ borderRadius: '8px 8px 0 0', padding: '10px 18px' }}
        >
          <FileText size={16} /> Goods Receipts & POs ({purchases.length})
        </button>
        <button
          className={`btn ${activeTab === 'suppliers' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('suppliers')}
          style={{ borderRadius: '8px 8px 0 0', padding: '10px 18px' }}
        >
          <Truck size={16} /> Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* Purchases List */}
      {activeTab === 'purchases' && (
        <div className="table-container">
          <table className="pos-table">
            <thead>
              <tr>
                <th>Invoice / PO #</th>
                <th>Date</th>
                <th>Supplier Company</th>
                <th>Items Count</th>
                <th>Grand Total (৳)</th>
                <th>Paid (৳)</th>
                <th>Due / Payable (৳)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                      {p.invoice_number}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{p.purchase_date}</td>
                  <td style={{ fontWeight: 600 }}>{p.supplierName}</td>
                  <td>{p.itemsCount} lines</td>
                  <td style={{ fontWeight: 700 }}>৳{p.grand_total.toFixed(2)}</td>
                  <td>৳{p.paid_amount.toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: p.due_amount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    ৳{p.due_amount.toFixed(2)}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: p.payment_status === 'paid' ? 'var(--success-light)' : 'var(--warning-light)',
                        color: p.payment_status === 'paid' ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      {p.payment_status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suppliers List */}
      {activeTab === 'suppliers' && (
        <div className="table-container">
          <table className="pos-table">
            <thead>
              <tr>
                <th>Supplier Company</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Total Purchases</th>
                <th>Total Paid</th>
                <th>Outstanding Payable</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{s.company_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.address}</div>
                  </td>
                  <td>{s.name}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{s.phone}</span>
                  </td>
                  <td>৳{s.total_purchased.toFixed(2)}</td>
                  <td>৳{s.total_paid.toFixed(2)}</td>
                  <td>
                    <span
                      style={{
                        fontWeight: 800,
                        color: s.total_payable > 0 ? 'var(--danger)' : 'var(--success)',
                      }}
                    >
                      ৳{s.total_payable.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Register New Supplier</h3>
              <button
                onClick={() => setShowAddSupplierModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Company / Distributor Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={newSupplier.companyName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, companyName: e.target.value })}
                    placeholder="e.g. Meghna Distribution Network"
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
                    Contact Person Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    placeholder="e.g. Kazi Mahbub"
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
                    Phone Number:
                  </label>
                  <input
                    type="text"
                    required
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="e.g. +880 1711-223344"
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
                    Address / Warehouse Location:
                  </label>
                  <input
                    type="text"
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    placeholder="e.g. Tejgaon Industrial Area, Dhaka"
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSupplierModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Goods Purchase Modal */}
      {showNewPurchaseModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Record Goods Receipt / Purchase</h3>
              <button
                onClick={() => setShowNewPurchaseModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPurchase}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Select Supplier:
                  </label>
                  <select
                    value={purchaseForm.supplierId}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.company_name} ({s.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Goods Received Items:</label>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={addPurchaseLine}>
                      <Plus size={12} /> Add Item Line
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {purchaseForm.items.map((line, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr auto',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '6px',
                          background: 'var(--bg-subtle)',
                          borderRadius: '6px',
                        }}
                      >
                        <select
                          value={line.productId}
                          onChange={(e) => {
                            const pId = e.target.value;
                            const pr = products.find((p) => p.id === pId);
                            setPurchaseForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === idx ? { ...it, productId: pId, unitCost: pr ? pr.costPrice : it.unitCost } : it
                              ),
                            }));
                          }}
                          style={{ padding: '6px', fontSize: '12px', borderRadius: '4px' }}
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={(e) => {
                            const q = parseFloat(e.target.value) || 1;
                            setPurchaseForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) => (i === idx ? { ...it, quantity: q } : it)),
                            }));
                          }}
                          style={{ padding: '6px', fontSize: '12px', borderRadius: '4px' }}
                        />

                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Unit Cost"
                          value={line.unitCost}
                          onChange={(e) => {
                            const c = parseFloat(e.target.value) || 0;
                            setPurchaseForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) => (i === idx ? { ...it, unitCost: c } : it)),
                            }));
                          }}
                          style={{ padding: '6px', fontSize: '12px', borderRadius: '4px' }}
                        />

                        <button
                          type="button"
                          onClick={() => removePurchaseLine(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PURCHASE GRAND TOTAL</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>
                      ৳{calculatedTotal.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Paid Amount (৳):
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={purchaseForm.paidAmount || ''}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, paidAmount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '16px',
                        fontWeight: 700,
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewPurchaseModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Receipt & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
