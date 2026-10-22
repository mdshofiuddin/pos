export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  branchId: string;
  branchName?: string;
  permissions: string[];
}

export interface Product {
  id: string;
  branchId: string;
  categoryId: string;
  categoryName: string;
  unitId: string;
  unitName: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  costPrice: number;
  sellingPrice: number;
  minStockThreshold: number;
  maxStockThreshold: number;
  taxRate: number;
  isActive: number;
  currentStock: number;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description: string;
  productCount?: number;
}

export interface Unit {
  id: string;
  name: string;
  short_name: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CashSession {
  id: string;
  branch_id: string;
  user_id: string;
  cashierName?: string;
  opening_time: string;
  closing_time?: string;
  opening_cash: number;
  total_cash_sales: number;
  total_cash_refunds: number;
  total_cash_in: number;
  total_cash_out: number;
  expected_cash: number;
  counted_cash?: number;
  cash_variance?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  credit_limit: number;
  current_due: number;
  loyalty_points: number;
  totalInvoices?: number;
  totalPurchasedAmount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  company_name: string;
  phone: string;
  email?: string;
  address?: string;
  total_purchased: number;
  total_paid: number;
  total_payable: number;
  totalPurchases?: number;
}

export interface ThermalReceiptData {
  invoiceNumber: string;
  saleId: string;
  date: string;
  cashier: string;
  customerName: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  payments: Array<{
    method: string;
    amount: number;
    transactionRef?: string;
  }>;
}
