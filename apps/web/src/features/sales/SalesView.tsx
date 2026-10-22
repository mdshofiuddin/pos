import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { ThermalReceiptData } from '../../types';
import { ThermalReceiptModal } from '../../components/ThermalReceiptModal';
import { Search, Printer, RotateCcw, Ban, Download, FileText } from 'lucide-react';

export const SalesView: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Reprint Modal
  const [receiptToPrint, setReceiptToPrint] = useState<ThermalReceiptData | null>(null);

  // Return Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any>(null);
  const [returnItemsState, setReturnItemsState] = useState<
    Array<{ saleItemId: string; productName: string; maxQty: number; returnQty: number; condition: 'resellable' | 'damaged' }>
  >([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnRefundMethod, setReturnRefundMethod] = useState<'cash' | 'credit' | 'card' | 'mfs'>('cash');
  const [returnLoading, setReturnLoading] = useState(false);

  // Void Modal
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidSaleId, setVoidSaleId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => {
    loadSales();
  }, [status]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<any[]>(
        `/sales?status=${status}&search=${encodeURIComponent(search)}&limit=50`
      );
      setSales(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = async (saleId: string) => {
    try {
      const fullSale = await apiRequest<any>(`/sales/${saleId}`);

      const receiptPayload: ThermalReceiptData = {
        invoiceNumber: fullSale.invoice_number,
        saleId: fullSale.id,
        date: fullSale.created_at,
        cashier: fullSale.cashierName || 'Cashier',
        customerName: fullSale.customerName || 'Walk-in Customer',
        items: fullSale.items.map((i: any) => ({
          name: i.product_name,
          sku: i.product_sku,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          total: i.line_total,
        })),
        subtotal: fullSale.subtotal,
        discountAmount: fullSale.discount_amount,
        taxAmount: fullSale.tax_amount,
        grandTotal: fullSale.grand_total,
        paidAmount: fullSale.paid_amount,
        changeAmount: fullSale.change_amount,
        payments: fullSale.payments.map((p: any) => ({
          method: p.method,
          amount: p.amount,
        })),
      };

      setReceiptToPrint(receiptPayload);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch invoice for reprint');
    }
  };

  const openReturnModal = async (saleId: string) => {
    try {
      const fullSale = await apiRequest<any>(`/sales/${saleId}`);
      setSelectedSaleDetail(fullSale);

      const itemsForReturn = fullSale.items
        .filter((i: any) => i.quantity - i.returned_qty > 0)
        .map((i: any) => ({
          saleItemId: i.id,
          productName: i.product_name,
          maxQty: i.quantity - i.returned_qty,
          returnQty: 0,
          condition: 'resellable' as const,
        }));

      if (itemsForReturn.length === 0) {
        alert('All items from this invoice have already been returned.');
        return;
      }

      setReturnItemsState(itemsForReturn);
      setReturnReason('');
      setShowReturnModal(true);
    } catch (err: any) {
      alert(err.message || 'Error loading invoice details for return');
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsToSubmit = returnItemsState
      .filter((i) => i.returnQty > 0)
      .map((i) => ({
        saleItemId: i.saleItemId,
        quantity: i.returnQty,
        condition: i.condition,
      }));

    if (itemsToSubmit.length === 0) {
      alert('Please specify return quantity for at least one item.');
      return;
    }

    setReturnLoading(true);
    try {
      await apiRequest('/returns', {
        method: 'POST',
        body: JSON.stringify({
          saleId: selectedSaleDetail.id,
          items: itemsToSubmit,
          reason: returnReason,
          refundMethod: returnRefundMethod,
        }),
      });

      setShowReturnModal(false);
      loadSales();
      alert('Return processed and refund recorded successfully.');
    } catch (err: any) {
      alert(err.message || 'Return failed');
    } finally {
      setReturnLoading(false);
    }
  };

  const handleVoidInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidSaleId) return;

    try {
      await apiRequest(`/sales/${voidSaleId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason }),
      });
      setShowVoidModal(false);
      setVoidSaleId(null);
      setVoidReason('');
      loadSales();
      alert('Invoice successfully voided and inventory reversed in ledger.');
    } catch (err: any) {
      alert(err.message || 'Void failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Sales & Invoice History</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Search invoices, reprint thermal receipts, process audited returns or voids
          </p>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header-bar">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="search-input-wrap" style={{ width: '280px' }}>
              <Search size={16} className="search-icon-pos" />
              <input
                type="text"
                placeholder="Search invoice # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadSales()}
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="returned">Returned</option>
              <option value="voided">Voided</option>
            </select>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing {sales.length} recent invoices
          </div>
        </div>

        <table className="pos-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Cashier</th>
              <th>Grand Total (৳)</th>
              <th>Paid (৳)</th>
              <th>Payment Method</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                    {s.invoiceNumber}
                  </span>
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(s.createdAt).toLocaleString()}
                </td>
                <td style={{ fontWeight: 600 }}>{s.customerName}</td>
                <td>{s.cashierName}</td>
                <td style={{ fontWeight: 700 }}>৳{s.grandTotal.toFixed(2)}</td>
                <td>৳{s.paidAmount.toFixed(2)}</td>
                <td>
                  <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}>
                    {s.paymentMethods || 'CASH'}
                  </span>
                </td>
                <td>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor:
                        s.saleStatus === 'completed'
                          ? 'var(--success-light)'
                          : s.saleStatus === 'voided'
                          ? 'var(--danger-light)'
                          : 'var(--warning-light)',
                      color:
                        s.saleStatus === 'completed'
                          ? 'var(--success)'
                          : s.saleStatus === 'voided'
                          ? 'var(--danger)'
                          : 'var(--warning)',
                    }}
                  >
                    {s.saleStatus.toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => handleReprint(s.id)}
                      title="Reprint Receipt"
                    >
                      <Printer size={13} /> Reprint
                    </button>

                    {s.saleStatus === 'completed' && (
                      <>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', color: '#b91c1c' }}
                          onClick={() => openReturnModal(s.id)}
                          title="Process Return"
                        >
                          <RotateCcw size={13} /> Return
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }}
                          onClick={() => {
                            setVoidSaleId(s.id);
                            setShowVoidModal(true);
                          }}
                          title="Void Invoice"
                        >
                          <Ban size={13} /> Void
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Return & Refund Modal */}
      {showReturnModal && selectedSaleDetail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                Return Items from Invoice {selectedSaleDetail.invoice_number}
              </h3>
              <button
                onClick={() => setShowReturnModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessReturn}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Specify the quantity to return and select item condition. Only resellable goods are returned to active stock.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {returnItemsState.map((item, idx) => (
                    <div
                      key={item.saleItemId}
                      style={{
                        padding: '10px',
                        background: 'var(--bg-subtle)',
                        borderRadius: '8px',
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.productName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Max returnable: {item.maxQty} pcs
                        </div>
                      </div>

                      <div>
                        <input
                          type="number"
                          min="0"
                          max={item.maxQty}
                          value={item.returnQty || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setReturnItemsState((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, returnQty: Math.min(val, it.maxQty) } : it))
                            );
                          }}
                          placeholder="0"
                          style={{
                            width: '100%',
                            padding: '6px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            fontSize: '12px',
                          }}
                        />
                      </div>

                      <div>
                        <select
                          value={item.condition}
                          onChange={(e) => {
                            const val = e.target.value as 'resellable' | 'damaged';
                            setReturnItemsState((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, condition: val } : it))
                            );
                          }}
                          style={{
                            width: '100%',
                            padding: '6px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            fontSize: '12px',
                          }}
                        >
                          <option value="resellable">Resellable</option>
                          <option value="damaged">Damaged</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Refund Method:
                    </label>
                    <select
                      value={returnRefundMethod}
                      onChange={(e) => setReturnRefundMethod(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <option value="cash">Cash Refund</option>
                      <option value="credit">Customer Credit / Due Offset</option>
                      <option value="mfs">Mobile Financial Service (MFS)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      Return Reason (Required):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Expired packaging / Customer change of mind"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={returnLoading}>
                  {returnLoading ? 'Processing...' : 'Confirm Return & Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Invoice Confirmation Modal */}
      {showVoidModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--danger)' }}>Void Entire Invoice</h3>
              <button
                onClick={() => setShowVoidModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVoidInvoice}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Warning: Voiding an invoice will reverse all product quantities back into stock and record a reversing entry in the stock ledger.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Reason for Void (Mandatory Audit):
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter explicit reason for voiding this invoice..."
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowVoidModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reprint Receipt Modal */}
      {receiptToPrint && (
        <ThermalReceiptModal
          receipt={receiptToPrint}
          onClose={() => setReceiptToPrint(null)}
        />
      )}
    </div>
  );
};
