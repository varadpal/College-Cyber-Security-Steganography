import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';

export function StatusBar() {
  const { state } = useAppContext();
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sStatus = state.sender?.status ?? 'idle';
  const rStatus = state.receiver?.status ?? 'idle';
  const aStatus = state.analysis?.status ?? 'idle';

  const overallStatus =
    [sStatus, rStatus, aStatus].find(s => s === 'loading') ??
    [sStatus, rStatus, aStatus].find(s => s === 'error') ??
    [sStatus, rStatus, aStatus].find(s => s === 'success') ??
    'idle';

  const statusColor =
    overallStatus === 'error'   ? 'var(--error)' :
    overallStatus === 'success' ? 'var(--accent)' :
    overallStatus === 'loading' ? 'var(--secondary)' :
    'var(--primary)';

  return (
    <div
      className="mono"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: 'rgba(4, 4, 10, 0.95)',
        borderTop: '1px solid var(--border)',
        padding: '0.4rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <span>
          STATUS:{' '}
          <span style={{ color: statusColor, fontWeight: 700 }}>
            {overallStatus.toUpperCase()}
          </span>
        </span>
        <span>TERMINAL: STN-VX-02</span>
        <span>REGION: BYTESPACE-A</span>
        <span>LOG_ENTRIES: {state.activityLog?.length ?? 0}</span>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <span>v2.1.0-ADVANCED</span>
        <span style={{ color: 'var(--primary)' }}>{time}</span>
      </div>
    </div>
  );
}
