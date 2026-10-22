import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { CashSession } from '../../types';
import { DollarSign, Clock, ArrowDownRight, ArrowUpRight, CheckCircle, AlertTriangle, Lock } from 'lucide-react';

interface Props {
  activeSession: CashSession | null;
  onSessionUpdated: (session: CashSession | null) => void;
}

export const SessionsView: React.FC<Props> = ({ activeSession, onSessionUpdated }) => {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);

  // Forms
  const [openingCash, setOpeningCash] = useState<number>(5000);
  const [openNotes, setOpenNotes] = useState('');

  const [countedCash, setCountedCash] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState('');

  const [movementForm, setMovementForm] = useState({
    type: 'expense' as 'cash_in' | 'cash_out' | 'expense',
    amount: 0,
    reason: '',
  });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const list = await apiRequest<CashSession[]>('/cash-sessions');
      setSessions(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/cash-sessions/open', {
        method: 'POST',
        body: JSON.stringify({ openingCash, notes: openNotes }),
      });
      setShowOpenModal(false);
      // Reload current
      const cur = await apiRequest<CashSession | null>('/cash-sessions/current');
      onSessionUpdated(cur);
      loadSessions();
      alert('Cashier session opened successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to open session');
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const counted = parseFloat(countedCash) || 0;

    try {
      const res = await apiRequest<any>(`/cash-sessions/${activeSession.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ countedCash: counted, notes: closeNotes }),
      });

      setShowCloseModal(false);
      onSessionUpdated(null);
      loadSessions();
      alert(
        `Session closed. Expected: ৳${res.expectedCash.toFixed(2)}, Counted: ৳${res.countedCash.toFixed(2)}, Variance: ৳${res.variance.toFixed(2)}`
      );
    } catch (err: any) {
      alert(err.message || 'Failed to close session');
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    try {
      await apiRequest('/cash-sessions/movements', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSession.id,
          movementType: movementForm.type,
          amount: movementForm.amount,
          reason: movementForm.reason,
        }),
      });

      setShowMovementModal(false);
      setMovementForm({ type: 'expense', amount: 0, reason: '' });
      const cur = await apiRequest<CashSession | null>('/cash-sessions/current');
      onSessionUpdated(cur);
      loadSessions();
      alert('Cash movement recorded successfully.');
    } catch (err: any) {
      alert(err.message || 'Movement failed');
    }
  };

  const countedNum = parseFloat(countedCash) || 0;
  const liveVariance = activeSession ? countedNum - activeSession.expected_cash : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Cashier Sessions & Register</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Track register cash float, petty cash expenses, and closing variance reconciliations
          </p>
        </div>

        <div>
          {!activeSession ? (
            <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>
              <DollarSign size={16} /> Open Cash Register
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowMovementModal(true)}>
                <ArrowDownRight size={16} /> Cash In / Expense
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setCountedCash(activeSession.expected_cash.toFixed(2));
                  setShowCloseModal(true);
                }}
              >
                <Lock size={16} /> Close Register & Count Cash
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Session Status Card */}
      {activeSession ? (
        <div
          style={{
            background: 'var(--bg-card)',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)',
                  boxShadow: '0 0 8px var(--success)',
                }}
              />
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Active Cash Register Session ({activeSession.id})</h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Opened at: {new Date(activeSession.opening_time).toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>OPENING CASH FLOAT</div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                ৳{activeSession.opening_cash.toFixed(2)}
              </div>
            </div>

            <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>CASH SALES COLLECTED</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
                +৳{activeSession.total_cash_sales.toFixed(2)}
              </div>
            </div>

            <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>CASH REFUNDS PAID</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)', marginTop: '4px' }}>
                -৳{activeSession.total_cash_refunds.toFixed(2)}
              </div>
            </div>

            <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>EXPENSES / CASH-OUT</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>
                -৳{activeSession.total_cash_out.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                background: 'var(--primary-light)',
                borderRadius: '10px',
                border: '1px solid rgba(37, 99, 235, 0.2)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>
                CALCULATED EXPECTED CASH
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
                ৳{activeSession.expected_cash.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '24px',
            background: 'var(--warning-light)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={24} color="var(--warning)" />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No Register Session is Currently Open</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                You must open a cash session with an opening float before conducting POS checkouts.
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>
            Open Register Now
          </button>
        </div>
      )}

      {/* History Table */}
      <div className="table-container">
        <div className="table-header-bar">
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Cash Sessions History & Audit Variance</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing previous register shifts
          </span>
        </div>

        <table className="pos-table">
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Opening Time</th>
              <th>Closing Time</th>
              <th>Cashier</th>
              <th>Opening Cash</th>
              <th>Cash Sales</th>
              <th>Expected Cash</th>
              <th>Counted Cash</th>
              <th>Variance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((cs) => (
              <tr key={cs.id}>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{cs.id}</span>
                </td>
                <td style={{ fontSize: '12px' }}>{new Date(cs.opening_time).toLocaleString()}</td>
                <td style={{ fontSize: '12px' }}>
                  {cs.closing_time ? new Date(cs.closing_time).toLocaleString() : 'In Progress'}
                </td>
                <td style={{ fontWeight: 600 }}>{cs.cashierName}</td>
                <td>৳{cs.opening_cash.toFixed(2)}</td>
                <td style={{ color: 'var(--success)', fontWeight: 600 }}>৳{cs.total_cash_sales.toFixed(2)}</td>
                <td style={{ fontWeight: 700 }}>৳{cs.expected_cash.toFixed(2)}</td>
                <td>{cs.counted_cash !== null && cs.counted_cash !== undefined ? `৳${cs.counted_cash.toFixed(2)}` : '—'}</td>
                <td>
                  {cs.cash_variance !== null && cs.cash_variance !== undefined ? (
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          cs.cash_variance === 0
                            ? 'var(--success)'
                            : cs.cash_variance < 0
                            ? 'var(--danger)'
                            : 'var(--primary)',
                      }}
                    >
                      {cs.cash_variance > 0 ? `+৳${cs.cash_variance.toFixed(2)}` : `৳${cs.cash_variance.toFixed(2)}`}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: cs.status === 'open' ? 'var(--success-light)' : 'var(--bg-subtle)',
                      color: cs.status === 'open' ? 'var(--success)' : 'var(--text-muted)',
                    }}
                  >
                    {cs.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Open Register Modal */}
      {showOpenModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Open Cash Register</h3>
              <button
                onClick={() => setShowOpenModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenSession}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Opening Cash Float (৳):
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={openingCash}
                    onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
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
                    Session Notes (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning Shift"
                    value={openNotes}
                    onChange={(e) => setOpenNotes(e.target.value)}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowOpenModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Open Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseModal && activeSession && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Close Cash Register</h3>
              <button
                onClick={() => setShowCloseModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCloseSession}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SYSTEM CALCULATED EXPECTED CASH</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>
                    ৳{activeSession.expected_cash.toFixed(2)}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Counted Physical Cash in Drawer (৳):
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
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

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background:
                      liveVariance === 0
                        ? 'var(--success-light)'
                        : liveVariance < 0
                        ? 'var(--danger-light)'
                        : 'var(--primary-light)',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Variance:</span>
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color:
                        liveVariance === 0
                          ? 'var(--success)'
                          : liveVariance < 0
                          ? 'var(--danger)'
                          : 'var(--primary)',
                    }}
                  >
                    {liveVariance === 0
                      ? '৳0.00 (Balanced Exact)'
                      : liveVariance < 0
                      ? `-৳${Math.abs(liveVariance).toFixed(2)} (Shortage)`
                      : `+৳${liveVariance.toFixed(2)} (Surplus)`}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Closing Notes:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified by Store Manager"
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Finalize & Close Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash Movement / Expense Modal */}
      {showMovementModal && activeSession && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Record Cash Movement</h3>
              <button
                onClick={() => setShowMovementModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordMovement}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Movement Type:
                  </label>
                  <select
                    value={movementForm.type}
                    onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <option value="expense">Store Petty Expense (- Cash)</option>
                    <option value="cash_out">Cash Out to Vault (- Cash)</option>
                    <option value="cash_in">Cash In / Add Float (+ Cash)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Amount (৳):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={movementForm.amount || ''}
                    onChange={(e) => setMovementForm({ ...movementForm, amount: parseFloat(e.target.value) || 0 })}
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
                    Reason (Required for audit):
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Cleaning supplies / Staff tea"
                    value={movementForm.reason}
                    onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowMovementModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
