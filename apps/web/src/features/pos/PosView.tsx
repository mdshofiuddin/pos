import React, { useState, useEffect, useRef } from 'react';
import { Product, Category, CartItem, Customer, CashSession, ThermalReceiptData } from '../../types';
import { apiRequest } from '../../api/client';
import { ThermalReceiptModal } from '../../components/ThermalReceiptModal';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  DollarSign,
  UserCheck,
  PauseCircle,
  PlayCircle,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  activeSession: CashSession | null;
  onOpenSessionRequired: () => void;
}

export const PosView: React.FC<Props> = ({ activeSession, onOpenSessionRequired }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [heldCarts, setHeldCarts] = useState<Array<{ id: string; customerId: string; items: CartItem[]; timestamp: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bkash' | 'nagad' | 'due'>('cash');
  const [tenderedCash, setTenderedCash] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Completed Receipt Modal State
  const [completedReceipt, setCompletedReceipt] = useState<ThermalReceiptData | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCatalog();
    loadCustomers();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const prods = await apiRequest<Product[]>('/products');
      const cats = await apiRequest<Category[]>('/categories');
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const custs = await apiRequest<Customer[]>('/customers');
      setCustomers(custs);
    } catch (err) {
      console.error(err);
    }
  };

  // Barcode / Search Enter Handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchQuery.trim();
      if (!term) return;

      // Exact match by barcode first
      const matched = products.find(
        (p) => p.barcode.toLowerCase() === term.toLowerCase() || p.sku.toLowerCase() === term.toLowerCase()
      );

      if (matched) {
        addToCart(matched);
        setSearchQuery('');
      }
    }
  };

  // Add Product to Cart
  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      alert(`"${product.name}" is currently OUT OF STOCK.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          alert(`Cannot add more than available stock (${product.currentStock} units).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, lineTotal: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: product.sellingPrice,
          lineTotal: product.sellingPrice,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.currentStock) {
              alert(`Maximum available stock reached (${item.product.currentStock}).`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              lineTotal: newQty * item.unitPrice,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountType('none');
    setDiscountValue(0);
  };

  // Hold & Resume Cart Tickets
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: `TKT-${heldCarts.length + 1}`,
      customerId: selectedCustomerId,
      items: [...cart],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHeldCarts((prev) => [...prev, newHold]);
    clearCart();
  };

  const handleResumeCart = (holdId: string) => {
    const target = heldCarts.find((h) => h.id === holdId);
    if (!target) return;
    setCart(target.items);
    setSelectedCustomerId(target.customerId);
    setHeldCarts((prev) => prev.filter((h) => h.id !== holdId));
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.lineTotal, 0);
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = Math.round(subtotal * (discountValue / 100) * 100) / 100;
  } else if (discountType === 'fixed') {
    discountAmount = Math.min(discountValue, subtotal);
  }
  const taxAmount = Math.round((subtotal - discountAmount) * 0.05 * 100) / 100;
  const grandTotal = Math.max(0, Math.round((subtotal - discountAmount + taxAmount) * 100) / 100);

  const tenderedNum = parseFloat(tenderedCash) || 0;
  const changeDue = Math.max(0, Math.round((tenderedNum - grandTotal) * 100) / 100);

  // Open Checkout Modal
  const initiateCheckout = () => {
    if (!activeSession) {
      onOpenSessionRequired();
      return;
    }
    if (cart.length === 0) return;
    setTenderedCash(grandTotal.toFixed(2));
    setCheckoutError(null);
    setShowPaymentModal(true);
  };

  // Submit Final Sale
  const handleCompleteSale = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);

    const idempotencyKey = crypto.randomUUID();

    const paymentAmount = paymentMethod === 'cash' ? tenderedNum : grandTotal;

    const payload = {
      idempotencyKey,
      customerId: selectedCustomerId || null,
      discountType,
      discountValue,
      items: cart.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      })),
      payments: [
        {
          method: paymentMethod,
          amount: paymentAmount,
          transactionRef: transactionRef || undefined,
        },
      ],
      notes: 'Counter POS sale',
    };

    try {
      const receiptData = await apiRequest<ThermalReceiptData>('/sales/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowPaymentModal(false);
      clearCart();
      setCompletedReceipt(receiptData);
      loadCatalog(); // Refresh stock in background
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Filter products by category and search
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="pos-layout">
      {/* Left Panel: Catalog & Products */}
      <div className="pos-products-panel">
        <div className="pos-search-header">
          <div className="search-input-wrap">
            <Search size={18} className="search-icon-pos" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by product name, SKU or scan barcode [Enter]..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
          </div>

          <div className="category-pills">
            <button
              className={`cat-pill ${selectedCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('ALL')}
            >
              All Items ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`cat-pill ${selectedCategory === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="pos-grid">
          {filteredProducts.map((p) => {
            const isOutOfStock = p.currentStock <= 0;
            const isLowStock = p.currentStock > 0 && p.currentStock <= p.minStockThreshold;

            return (
              <div
                key={p.id}
                className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                onClick={() => addToCart(p)}
              >
                <div>
                  <div className="product-card-barcode">{p.barcode}</div>
                  <div className="product-card-title">{p.name}</div>
                </div>

                <div className="product-card-footer">
                  <span className="product-card-price">৳{p.sellingPrice.toFixed(2)}</span>
                  <span
                    className={`stock-tag ${
                      isOutOfStock ? 'out' : isLowStock ? 'low' : 'in'
                    }`}
                  >
                    {isOutOfStock ? 'Out of Stock' : `${p.currentStock} ${p.unitName || 'pcs'}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel: Interactive Cart */}
      <div className="pos-cart-panel">
        <div className="cart-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Current Ticket</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({cart.length} items)</span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {heldCarts.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                onClick={() => handleResumeCart(heldCarts[0].id)}
                title="Resume Held Cart"
              >
                <PlayCircle size={14} color="#10b981" /> Resume ({heldCarts.length})
              </button>
            )}
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              onClick={handleHoldCart}
              disabled={cart.length === 0}
              title="Hold Cart"
            >
              <PauseCircle size={14} /> Hold
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }}
              onClick={clearCart}
              disabled={cart.length === 0}
              title="Clear Cart"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Customer Selector */}
        <div className="cart-customer-selector">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
              <UserCheck size={14} color="var(--primary)" /> Customer:
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                maxWidth: '180px',
              }}
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer && selectedCustomer.current_due > 0 && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '11px',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <AlertTriangle size={12} />
              <span>Outstanding Due: ৳{selectedCustomer.current_due.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Cart Line Items */}
        <div className="cart-items-list">
          {cart.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                gap: '8px',
              }}
            >
              <Barcode size={36} strokeWidth={1.5} />
              <p style={{ fontSize: '13px' }}>Scan or select products to begin</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.product.name}</div>
                  <div className="cart-item-unit-price">
                    ৳{item.unitPrice.toFixed(2)} x {item.quantity}
                  </div>
                </div>

                <div className="cart-qty-control">
                  <button className="qty-btn" onClick={() => updateQuantity(item.product.id, -1)}>
                    <Minus size={12} />
                  </button>
                  <span className="qty-display">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQuantity(item.product.id, 1)}>
                    <Plus size={12} />
                  </button>
                </div>

                <div className="cart-item-total">৳{item.lineTotal.toFixed(2)}</div>

                <button
                  onClick={() => removeFromCart(item.product.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Cart Totals & Checkout Button */}
        <div className="cart-footer">
          <div className="cart-summary-line">
            <span>Subtotal:</span>
            <span>৳{subtotal.toFixed(2)}</span>
          </div>

          <div className="cart-summary-line" style={{ display: 'flex', alignItems: 'center' }}>
            <span>Discount:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px' }}
              >
                <option value="none">None</option>
                <option value="percentage">%</option>
                <option value="fixed">৳ Fixed</option>
              </select>
              {discountType !== 'none' && (
                <input
                  type="number"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  style={{ width: '50px', fontSize: '11px', padding: '2px 4px', borderRadius: '4px' }}
                />
              )}
            </div>
            {discountAmount > 0 && <span style={{ color: 'var(--danger)' }}>-৳{discountAmount.toFixed(2)}</span>}
          </div>

          <div className="cart-summary-line">
            <span>Tax / VAT (5%):</span>
            <span>৳{taxAmount.toFixed(2)}</span>
          </div>

          <div className="cart-summary-line grand-total">
            <span>Total Payable:</span>
            <span style={{ color: 'var(--primary)' }}>৳{grandTotal.toFixed(2)}</span>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            disabled={cart.length === 0}
            onClick={initiateCheckout}
          >
            <CreditCard size={18} /> Proceed to Pay (৳{grandTotal.toFixed(2)})
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Complete Sale Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {checkoutError && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#fef2f2',
                    color: '#b91c1c',
                    borderRadius: '8px',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {checkoutError}
                </div>
              )}

              <div
                style={{
                  textAlign: 'center',
                  padding: '16px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: '12px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TOTAL AMOUNT DUE</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)' }}>
                  ৳{grandTotal.toFixed(2)}
                </div>
              </div>

              {/* Payment Methods */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                  Select Payment Method:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {(['cash', 'bkash', 'nagad', 'card', 'due'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      className={`btn ${paymentMethod === method ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '8px 4px', fontSize: '11px', textTransform: 'capitalize' }}
                      onClick={() => setPaymentMethod(method)}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Denominations and Change calculation */}
              {paymentMethod === 'cash' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                      Cash Received from Customer:
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={tenderedCash}
                      onChange={(e) => setTenderedCash(e.target.value)}
                      placeholder="Enter tendered amount"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        fontSize: '16px',
                        fontWeight: 700,
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        background: 'var(--bg-card)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[grandTotal, 500, 1000, 2000].map((val, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '6px 2px', fontSize: '11px' }}
                        onClick={() => setTenderedCash(val.toFixed(2))}
                      >
                        ৳{val.toFixed(0)}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: changeDue > 0 ? 'var(--success-light)' : 'var(--bg-subtle)',
                      borderRadius: '8px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Change Due to Customer:</span>
                    <span
                      style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        color: changeDue > 0 ? 'var(--success)' : 'var(--text-primary)',
                      }}
                    >
                      ৳{changeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Mobile Wallet Transaction ID */}
              {(paymentMethod === 'bkash' || paymentMethod === 'nagad' || paymentMethod === 'card') && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    Transaction Reference / TrxID:
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. TRX-98271829"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleCompleteSale}
                disabled={checkoutLoading || (paymentMethod === 'cash' && tenderedNum < grandTotal)}
              >
                <Check size={16} /> {checkoutLoading ? 'Processing...' : 'Confirm & Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Thermal Receipt Modal */}
      {completedReceipt && (
        <ThermalReceiptModal
          receipt={completedReceipt}
          onClose={() => setCompletedReceipt(null)}
        />
      )}
    </div>
  );
};
