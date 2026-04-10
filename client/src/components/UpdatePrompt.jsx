import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 999, width: 'calc(100% - 32px)', maxWidth: 400,
      background: '#212121', borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Update Available</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>A new version of Vitals is ready.</div>
      </div>
      <button onClick={() => updateServiceWorker(true)}
        style={{
          padding: '8px 16px', borderRadius: 10, border: 'none',
          background: '#E53935', color: '#fff', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
        ↻ Update
      </button>
    </div>
  );
}
