import { useAppContext, LogEntry } from '../context/AppContext';

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  INFO: 'var(--primary)',
  SUCCESS: 'var(--accent)',
  WARN: '#ffd700',
  ERROR: 'var(--error)',
};

const LEVEL_PREFIX: Record<LogEntry['level'], string> = {
  INFO: '[INFO]',
  SUCCESS: '[OK]',
  WARN: '[WARN]',
  ERROR: '[ERR]',
};

export function ActivityLog() {
  const { state, dispatch } = useAppContext();
  const { activityLog } = state;

  return (
    <div style={{ fontFamily: 'Fira Code, monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--primary)', textShadow: '0 0 8px var(--primary-glow)' }}>
          // SESSION_AUDIT_LOG
        </h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {activityLog.length} ENTRIES
          </span>
          <button
            onClick={() => dispatch({ type: 'LOG_CLEAR' })}
            style={{
              background: 'transparent',
              border: '1px solid var(--error)',
              color: 'var(--error)',
              padding: '0.3rem 0.8rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
              borderRadius: '4px',
            }}
          >
            PURGE_LOG
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.7rem' }}>
        {(['INFO', 'SUCCESS', 'WARN', 'ERROR'] as LogEntry['level'][]).map(lvl => (
          <span key={lvl} style={{ color: LEVEL_COLORS[lvl] }}>
            {LEVEL_PREFIX[lvl]} {lvl}
          </span>
        ))}
      </div>

      {/* Log Entries */}
      <div
        style={{
          height: '420px',
          overflowY: 'auto',
          background: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '1rem',
        }}
      >
        {activityLog.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '5rem', fontSize: '0.8rem' }}>
            NO_ENTRIES_FOUND
          </p>
        ) : (
          activityLog.map(entry => (
            <div
              key={entry.id}
              style={{
                marginBottom: '0.4rem',
                display: 'grid',
                gridTemplateColumns: '80px 60px 90px 1fr',
                gap: '0.5rem',
                fontSize: '0.78rem',
                lineHeight: '1.5',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>{entry.timestamp}</span>
              <span style={{ color: LEVEL_COLORS[entry.level], fontWeight: 700 }}>
                {LEVEL_PREFIX[entry.level]}
              </span>
              <span style={{ color: 'var(--secondary)' }}>[{entry.module}]</span>
              <span style={{ color: entry.level === 'ERROR' ? 'var(--error)' : entry.level === 'SUCCESS' ? 'var(--accent)' : 'var(--text-main)' }}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Stats footer */}
      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(0, 242, 255, 0.04)',
          border: '1px solid var(--glass-border)',
          borderRadius: '4px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          fontSize: '0.75rem',
          textAlign: 'center',
        }}
      >
        {(['INFO', 'SUCCESS', 'WARN', 'ERROR'] as LogEntry['level'][]).map(lvl => (
          <div key={lvl}>
            <div style={{ color: 'var(--text-muted)' }}>{lvl}</div>
            <div style={{ color: LEVEL_COLORS[lvl], fontSize: '1.2rem', fontWeight: 700 }}>
              {activityLog.filter(e => e.level === lvl).length}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
