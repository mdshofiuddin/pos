import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { Settings, Save, Printer, Store, CheckCircle } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    shop_name: 'Apex Mart Superstore',
    shop_address: 'Plot 42, Block C, Gulshan-1, Dhaka-1212',
    shop_phone: '+880 1712-998877',
    vat_registration_number: 'BIN-003847291-01',
    default_tax_rate: '5.0',
    currency_symbol: '৳',
    thermal_printer_size: '58mm',
    receipt_footer_message: 'Thank you for shopping with us! No cash refund without receipt.',
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiRequest<Record<string, string>>('/settings');
      setSettings((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Store & POS Terminal Settings</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Configure thermal printer output, receipt details, tax policies, and store information
        </p>
      </div>

      {savedSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} /> Settings successfully saved and applied to POS receipts!
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Store Profile Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <Store size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Store Profile & Legal Information</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Store Display Name:
              </label>
              <input
                type="text"
                required
                value={settings.shop_name}
                onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                VAT / Tax Registration (BIN):
              </label>
              <input
                type="text"
                value={settings.vat_registration_number}
                onChange={(e) => setSettings({ ...settings, vat_registration_number: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Contact Phone:
              </label>
              <input
                type="text"
                value={settings.shop_phone}
                onChange={(e) => setSettings({ ...settings, shop_phone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Store Address:
              </label>
              <input
                type="text"
                value={settings.shop_address}
                onChange={(e) => setSettings({ ...settings, shop_address: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Thermal Receipt Configuration Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <Printer size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Thermal Receipt & Tax Configuration</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Receipt Paper Width:
              </label>
              <select
                value={settings.thermal_printer_size}
                onChange={(e) => setSettings({ ...settings, thermal_printer_size: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <option value="58mm">58mm Thermal Roll (Smallest / High Compact)</option>
                <option value="80mm">80mm Thermal Roll (Standard Retail Width)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Default VAT / Tax Rate (%):
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.default_tax_rate}
                onChange={(e) => setSettings({ ...settings, default_tax_rate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Receipt Bottom Policy Note:
            </label>
            <input
              type="text"
              value={settings.receipt_footer_message}
              onChange={(e) => setSettings({ ...settings, receipt_footer_message: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '12px 24px' }}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
};
