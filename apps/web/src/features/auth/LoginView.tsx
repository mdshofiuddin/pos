import React, { useState } from 'react';
import { apiRequest } from '../../api/client';
import { User, CashSession } from '../../types';
import { ShieldCheck, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { setToken } from '../../utils/tokenManager';

interface Props {
  onLoginSuccess: (user: User, session: CashSession | null) => void;
}

export const LoginView: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const u = customUser || username;
    const p = customPass || password;

    if (!u || !p) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest<{ token: string; user: User; activeSession: CashSession | null }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ username: u, password: p }),
        }
      );

      setToken(res.token);
      localStorage.setItem('pos_user', JSON.stringify(res.user));
      onLoginSuccess(res.user, res.activeSession);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    handleLogin(undefined, u, p);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(circle at 10% 20%, #0f172a 0%, #1e293b 90%)',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          padding: '36px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 10px 20px rgba(37, 99, 235, 0.3)',
              marginBottom: '14px',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Apex POS Security</h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Enterprise Authentication • Role-Based Access Control
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              borderRadius: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              border: '1px solid #fecaca',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => handleLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Username or Email
            </label>
            <div style={{ position: 'relative' }}>
              <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '6px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Terminal'}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textAlign: 'center', marginBottom: '10px' }}>
            DEMO QUICK ACCESS (1-CLICK ROLES)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fillQuickLogin('admin', 'AdminPassword@123')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px' }}
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => fillQuickLogin('manager', 'ManagerPassword@123')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px' }}
            >
              👔 Manager
            </button>
            <button
              type="button"
              onClick={() => fillQuickLogin('cashier', 'CashierPassword@123')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px' }}
            >
              🛒 Cashier
            </button>
            <button
              type="button"
              onClick={() => fillQuickLogin('inventory', 'InventoryPassword@123')}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '8px' }}
            >
              📦 Inventory Officer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
