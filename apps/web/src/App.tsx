import React, { useState, useEffect } from 'react';
import { User, CashSession } from './types';
import { apiRequest } from './api/client';

// Views
import { LoginView } from './features/auth/LoginView';
import { PosView } from './features/pos/PosView';
import { InventoryView } from './features/inventory/InventoryView';
import { SalesView } from './features/sales/SalesView';
import { SessionsView } from './features/sessions/SessionsView';
import { CustomersView } from './features/customers/CustomersView';
import { PurchasesView } from './features/purchases/PurchasesView';
import { ReportsView } from './features/reports/ReportsView';
import { UsersView } from './features/users/UsersView';
import { SettingsView } from './features/settings/SettingsView';

// Icons
import {
  ShoppingBag,
  Package,
  Receipt,
  DollarSign,
  Users,
  Truck,
  BarChart3,
  Shield,
  Settings,
  LogOut,
  Moon,
  Sun,
  Store,
} from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    // Check local session
    const savedUser = localStorage.getItem('pos_user');
    const token = localStorage.getItem('pos_token');

    if (savedUser && token) {
      try {
        const u: User = JSON.parse(savedUser);
        setCurrentUser(u);
        checkSession();
      } catch {
        localStorage.removeItem('pos_user');
        localStorage.removeItem('pos_token');
      }
    }
    setLoadingInitial(false);

    // Listen for auth expiration
    const handleAuthExpired = () => {
      setCurrentUser(null);
      setActiveSession(null);
    };
    window.addEventListener('auth:expired', handleAuthExpired);

    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const checkSession = async () => {
    try {
      const cs = await apiRequest<CashSession | null>('/cash-sessions/current');
      setActiveSession(cs);
    } catch {
      // ignore
    }
  };

  const handleLoginSuccess = (user: User, session: CashSession | null) => {
    setCurrentUser(user);
    setActiveSession(session);
    setActiveTab('pos');
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    setCurrentUser(null);
    setActiveSession(null);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  if (loadingInitial) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)' }}>
        <p style={{ fontWeight: 600 }}>Loading Apex Enterprise POS...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-badge">AP</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Apex Retail POS
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enterprise v1.0</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'pos' ? 'active' : ''}`}
            onClick={() => setActiveTab('pos')}
          >
            <ShoppingBag size={18} /> POS Terminal
          </button>

          <button
            className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={18} /> Inventory At A Glance
          </button>

          <button
            className={`nav-item ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            <Receipt size={18} /> Sales & Invoices
          </button>

          <button
            className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <DollarSign size={18} /> Cash Sessions
          </button>

          <button
            className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <Users size={18} /> Customers & Dues
          </button>

          <button
            className={`nav-item ${activeTab === 'purchases' ? 'active' : ''}`}
            onClick={() => setActiveTab('purchases')}
          >
            <Truck size={18} /> Purchasing & Suppliers
          </button>

          <button
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 size={18} /> 15 Reports & Audit
          </button>

          {currentUser.roleName === 'admin' && (
            <button
              className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Shield size={18} /> Users & Roles
            </button>
          )}

          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} /> Store Settings
          </button>
        </nav>

        {/* Sidebar Footer with user info & logout */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
              }}
            >
              {currentUser.username.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.fullName}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                {currentUser.roleName}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--danger)',
              padding: '6px',
            }}
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <Store size={15} color="var(--primary)" />
              <span style={{ fontWeight: 600 }}>{currentUser.branchName || 'Gulshan Flagship Store'}</span>
            </div>

            {/* Session Indicator Badge */}
            {activeSession ? (
              <div className="session-indicator open">
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--success)',
                  }}
                />
                <span>Register Open (Float: ৳{activeSession.opening_cash.toFixed(2)})</span>
              </div>
            ) : (
              <div
                className="session-indicator closed"
                onClick={() => setActiveTab('sessions')}
                style={{ cursor: 'pointer' }}
                title="Click to open register"
              >
                <span>⚠️ Register Closed (Click to Open)</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Dark/Light mode toggle */}
            <button
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
          </div>
        </header>

        {/* Page Body View Router (Zero Reload SPA) */}
        <div className="page-body">
          {activeTab === 'pos' && (
            <PosView
              activeSession={activeSession}
              onOpenSessionRequired={() => setActiveTab('sessions')}
            />
          )}

          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'sales' && <SalesView />}
          {activeTab === 'sessions' && (
            <SessionsView activeSession={activeSession} onSessionUpdated={setActiveSession} />
          )}
          {activeTab === 'customers' && <CustomersView />}
          {activeTab === 'purchases' && <PurchasesView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'users' && <UsersView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
}

export default App;
