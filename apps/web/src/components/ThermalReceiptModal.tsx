import React from 'react';
import { ThermalReceiptData } from '../types';
import { Printer, X, CheckCircle } from 'lucide-react';

interface Props {
  receipt: ThermalReceiptData | null;
  onClose: () => void;
  shopDetails?: {
    name?: string;
    address?: string;
    phone?: string;
    vatNumber?: string;
  };
}

export const ThermalReceiptModal: React.FC<Props> = ({ receipt, onClose, shopDetails }) => {
  if (!receipt) return null;

  const shopName = shopDetails?.name || 'Apex Mart Superstore';
  const shopAddress = shopDetails?.address || 'Plot 42, Block C, Gulshan-1, Dhaka';
  const shopPhone = shopDetails?.phone || '+880 1712-998877';
  const shopVat = shopDetails?.vatNumber || 'BIN: 003847291-01';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} color="#10b981" />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Sale Completed</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ backgroundColor: '#f1f5f9', display: 'flex', justifyContent: 'center', padding: '16px' }}>
          {/* Printable Thermal Receipt Card (58mm / 80mm compliant) */}
          <div id="thermal-printable-receipt" className="receipt-wrapper">
            <div className="receipt-header">
              <h3>{shopName}</h3>
              <p>{shopAddress}</p>
              <p>Tel: {shopPhone}</p>
              <p>{shopVat}</p>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-meta">
              <div className="receipt-meta-row">
                <span>Inv: {receipt.invoiceNumber}</span>
                <span>{new Date(receipt.date).toLocaleDateString()}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Cashier: {receipt.cashier}</span>
                <span>{new Date(receipt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Customer: {receipt.customerName}</span>
              </div>
            </div>

            <div className="receipt-divider" />

            <table className="receipt-table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Item</th>
                  <th style={{ textAlign: 'center', width: '20%' }}>Qty</th>
                  <th style={{ textAlign: 'right', width: '30%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <div>{item.name}</div>
                      <div style={{ fontSize: '9px', color: '#555' }}>
                        {item.quantity} x ৳{item.unitPrice.toFixed(2)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>৳{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="receipt-divider" />

            <div className="receipt-totals">
              <div className="receipt-totals-row">
                <span>Subtotal:</span>
                <span>৳{receipt.subtotal.toFixed(2)}</span>
              </div>

              {receipt.discountAmount > 0 && (
                <div className="receipt-totals-row" style={{ color: '#b91c1c' }}>
                  <span>Discount:</span>
                  <span>-৳{receipt.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="receipt-totals-row">
                <span>VAT / Tax (5%):</span>
                <span>৳{receipt.taxAmount.toFixed(2)}</span>
              </div>

              <div className="receipt-totals-row grand">
                <span>GRAND TOTAL:</span>
                <span>৳{receipt.grandTotal.toFixed(2)}</span>
              </div>

              <div className="receipt-totals-row" style={{ marginTop: '4px' }}>
                <span>Paid Amount:</span>
                <span>৳{receipt.paidAmount.toFixed(2)}</span>
              </div>

              {receipt.changeAmount > 0 && (
                <div className="receipt-totals-row">
                  <span>Change Return:</span>
                  <span>৳{receipt.changeAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="receipt-totals-row" style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
                <span>Method:</span>
                <span>{receipt.payments.map((p) => p.method.toUpperCase()).join(', ')}</span>
              </div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-footer">
              <p>*** THANK YOU FOR SHOPPING ***</p>
              <p>Please keep receipt for warranty / exchange</p>
              <div className="receipt-barcode">*{receipt.invoiceNumber.replace(/-/g, '')}*</div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print Receipt (58mm/80mm)
          </button>
        </div>
      </div>
    </div>
  );
};
