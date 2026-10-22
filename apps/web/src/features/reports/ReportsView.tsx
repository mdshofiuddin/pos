import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  RotateCcw,
  Users,
  Truck,
  Shield,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

interface ReportOption {
  id: string;
  name: string;
  category: 'Sales & Revenue' | 'Inventory & Stock' | 'Cash & Audit' | 'Payables & Receivables';
  endpoint: string;
  icon: any;
}

const REPORT_LIST: ReportOption[] = [
  // Sales & Revenue
  { id: '1', name: '1. Daily Sales Summary', category: 'Sales & Revenue', endpoint: '/reports/daily-sales', icon: DollarSign },
  { id: '2', name: '2. Product Sales Performance', category: 'Sales & Revenue', endpoint: '/reports/product-sales', icon: BarChart3 },
  { id: '3', name: '3. Category Sales Performance', category: 'Sales & Revenue', endpoint: '/reports/category-sales', icon: Layers },
  { id: '4', name: '4. Payment Methods Summary', category: 'Sales & Revenue', endpoint: '/reports/payment-methods', icon: DollarSign },
  { id: '5', name: '5. Gross Profit & Margin Report', category: 'Sales & Revenue', endpoint: '/reports/gross-profit', icon: TrendingUp },

  // Inventory & Stock
  { id: '6', name: '6. Real-Time Stock On-Hand', category: 'Inventory & Stock', endpoint: '/reports/stock-on-hand', icon: Package },
  { id: '7', name: '7. Low Stock & Reorder Alerts', category: 'Inventory & Stock', endpoint: '/reports/low-stock-alert', icon: AlertTriangle },
  { id: '8', name: '8. Stock Valuation Report', category: 'Inventory & Stock', endpoint: '/reports/stock-valuation', icon: TrendingUp },
  { id: '9', name: '9. Stock Movements & Ledger Audit', category: 'Inventory & Stock', endpoint: '/reports/stock-ledger', icon: Package },

  // Returns, Cash & Audit
  { id: '10', name: '10. Sales Returns & Refund Analysis', category: 'Cash & Audit', endpoint: '/reports/returns-analysis', icon: RotateCcw },
  { id: '11', name: '11. Cashier Shift & Variance Report', category: 'Cash & Audit', endpoint: '/reports/cashier-variance', icon: DollarSign },
  { id: '12', name: '12. Expenses & Operational Cashflow', category: 'Cash & Audit', endpoint: '/reports/expenses-cashflow', icon: DollarSign },
  { id: '13', name: '13. Security & System Audit Trail', category: 'Cash & Audit', endpoint: '/reports/audit-trail', icon: Shield },

  // Payables & Receivables
  { id: '14', name: '14. Customer Due & Receivables', category: 'Payables & Receivables', endpoint: '/reports/customer-due', icon: Users },
  { id: '15', name: '15. Supplier Payables & Purchases', category: 'Payables & Receivables', endpoint: '/reports/supplier-payables', icon: Truck },

  // Detailed Daybooks & Itemized Registers
  { id: '16', name: '16. Daily Sales & Purchase Daybook (দৈনিক ক্রয়-বিক্রয় খতিয়ান)', category: 'Sales & Revenue', endpoint: '/reports/daily-daybook', icon: TrendingUp },
  { id: '17', name: '17. Daily Detailed Sales Register (প্রতিটি বিক্রির বিস্তারিত আইটেম)', category: 'Sales & Revenue', endpoint: '/reports/daily-sales-details', icon: BarChart3 },
  { id: '18', name: '18. Daily Detailed Purchase Register (প্রতিটি ক্রয়ের বিস্তারিত আইটেম)', category: 'Payables & Receivables', endpoint: '/reports/daily-purchase-details', icon: Truck },
];

export const ReportsView: React.FC = () => {
  const [selectedReportId, setSelectedReportId] = useState<string>('1');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedReport = REPORT_LIST.find((r) => r.id === selectedReportId) || REPORT_LIST[0];

  useEffect(() => {
    loadReportData(selectedReport.endpoint);
  }, [selectedReportId]);

  const loadReportData = async (endpoint: string) => {
    try {
      setLoading(true);
      const data = await apiRequest<any[]>(endpoint);
      setReportData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // CSV Export utility for any report dataset
  const exportCSV = () => {
    if (reportData.length === 0) return;
    const sample = reportData[0];
    const keys = Object.keys(sample);

    const rows = reportData.map((row) =>
      keys
        .map((k) => {
          const val = row[k];
          if (val === null || val === undefined) return '""';
          if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
          return val;
        })
        .join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [keys.join(','), ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `${selectedReport.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Reports</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Comprehensive real-time financial, sales, inventory, and operational reports with 1-click CSV export
          </p>
        </div>

        <button className="btn btn-primary" onClick={exportCSV} disabled={reportData.length === 0}>
          <Download size={16} /> Export Selected Report (CSV)
        </button>
      </div>

      {/* Report Selector Bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          padding: '16px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          SELECT REPORT (15 REPORTS AVAILABLE):
        </label>
        <select
          value={selectedReportId}
          onChange={(e) => setSelectedReportId(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 700,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--primary)',
          }}
        >
          {REPORT_LIST.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} [{r.category}]
            </option>
          ))}
        </select>
      </div>

      {/* Report Table Display */}
      <div className="table-container">
        <div className="table-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <selectedReport.icon size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{selectedReport.name}</h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Total Records: {reportData.length}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading report data...
          </div>
        ) : reportData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No records found for this report.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pos-table">
              <thead>
                <tr>
                  {Object.keys(reportData[0]).map((colKey) => (
                    <th key={colKey} style={{ textTransform: 'capitalize' }}>
                      {colKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx}>
                    {Object.keys(row).map((k) => {
                      const val = row[k];
                      let displayVal = val;
                      if (typeof val === 'number') {
                        displayVal = k.toLowerCase().includes('rate') || k.toLowerCase().includes('percent')
                          ? `${val}%`
                          : k.toLowerCase().includes('price') || k.toLowerCase().includes('sales') || k.toLowerCase().includes('revenue') || k.toLowerCase().includes('cost') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('valuation') || k.toLowerCase().includes('profit') || k.toLowerCase().includes('due') || k.toLowerCase().includes('payable') || k.toLowerCase().includes('cash')
                          ? `৳${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : val.toLocaleString();
                      }
                      return (
                        <td key={k} style={{ fontSize: '12px' }}>
                          {displayVal === null || displayVal === undefined ? '—' : String(displayVal)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
