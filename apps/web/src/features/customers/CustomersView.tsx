import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Customer } from '../../types';
import { Users, Plus, DollarSign, Search, Phone, MapPin, CreditCard } from 'lucide-react';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayDueModal, setShowPayDueModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    creditLimit: 10000,
  });

  const [payDueForm, setPayDueForm] = useState({
    amount: 0,
    paymentMethod: 'cash' as 'cash' | 'bkash' | 'nagad' | 'card',
    notes: '',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Customer[]>(`/customers?search=${encodeURIComponent(search)}`);
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify(newCustomer),
      });
      setShowAddModal(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '', creditLimit: 10000 });
      loadCustomers();
      alert('Customer profile created successfully.');
    } catch (err: any) {
      alert(err.message || 'Creation failed');
    }
  };

  const handleCollectDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      await apiRequest(`/customers/${selectedCustomer.id}/pay-due`, {
        method: 'POST',
        body: JSON.stringify(payDueForm),
      });
      setShowPayDueModal(false);
      setSelectedCustomer(null);
      setPayDueForm({ amount: 0, paymentMethod: 'cash', notes: '' });
      loadCustomers();
      alert('Customer due collected and recorded in cash ledger.');
    } catch (err: any) {
      alert(err.message || 'Payment collection failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Customers & Credit Dues</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Manage customer accounts, purchase history, and collect outstanding due balances
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add New Customer
        </button>
      </div>

      <div className="table-container">
        <div className="table-header-bar">
          <div className="search-input-wrap" style={{ width: '280px' }}>
            <Search size={16} className="search-icon-pos" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
            />
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing {customers.length} registered customers
          </div>
        </div>

        <table className="pos-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Credit Limit</th>
              <th>Outstanding Due</th>
              <th>Purchases Count</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  {c.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.email}</div>}
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{c.phone}</span>
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.address || '—'}</td>
                <td>৳{c.credit_limit.toFixed(2)}</td>
                <td>
                  <span
                    style={{
                      fontWeight: 800,
                      color: c.current_due > 0 ? 'var(--danger)' : 'var(--success)',
                    }}
                  >
                    ৳{c.current_due.toFixed(2)}
                  </span>
                </td>
                <td>{c.totalInvoices || 0} invoices</td>
                <td style={{ textAlign: 'right' }}>
                  {c.current_due > 0 && (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setPayDueForm({ amount: c.current_due, paymentMethod: 'cash', notes: '' });
                        setShowPayDueModal(true);
                      }}
                    >
                      <DollarSign size={14} /> Collect Due
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Add New Customer</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="e.g. Tanvir Ahmed"
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
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="e.g. +880 1812-345678"
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
                    Address:
                  </label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="e.g. House 4, Road 11, Gulshan"
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
                    Credit Limit (৳):
                  </label>
                  <input
                    type="number"
                    value={newCustomer.creditLimit || ''}
                    onChange={(e) => setNewCustomer({ ...newCustomer, creditLimit: parseFloat(e.target.value) || 0 })}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Due Modal */}
      {showPayDueModal && selectedCustomer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Collect Due Payment</h3>
              <button
                onClick={() => setShowPayDueModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCollectDue}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700 }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedCustomer.phone}</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--danger)', marginTop: '4px' }}>
                    Current Due: ৳{selectedCustomer.current_due.toFixed(2)}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Payment Amount (৳):
                  </label>
                  <input
                    type="number"
                    step="any"
                    max={selectedCustomer.current_due}
                    min="1"
                    required
                    value={payDueForm.amount || ''}
                    onChange={(e) => setPayDueForm({ ...payDueForm, amount: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '18px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Payment Method:
                  </label>
                  <select
                    value={payDueForm.paymentMethod}
                    onChange={(e) => setPayDueForm({ ...payDueForm, paymentMethod: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <option value="cash">Cash (Deposited into active register)</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="card">Bank / Card</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Receipt Note:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Partial monthly due clearance"
                    value={payDueForm.notes}
                    onChange={(e) => setPayDueForm({ ...payDueForm, notes: e.target.value })}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayDueModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
