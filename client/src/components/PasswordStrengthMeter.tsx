interface Props {
  password: string;
}

function calcEntropy(pwd: string): number {
  if (!pwd) return 0;
  const charsetSize =
    (/[a-z]/.test(pwd) ? 26 : 0) +
    (/[A-Z]/.test(pwd) ? 26 : 0) +
    (/[0-9]/.test(pwd) ? 10 : 0) +
    (/[^a-zA-Z0-9]/.test(pwd) ? 32 : 0);
  return Math.round(pwd.length * Math.log2(Math.max(charsetSize, 1)));
}

function getCrackTime(entropy: number): string {
  // Assume 10^12 guesses/second (GPU cluster)
  const guesses = Math.pow(2, entropy);
  const seconds = guesses / 1e12;
  if (seconds < 1) return 'Instant';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}hr`;
  if (seconds < 2629800) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31557600) return `${Math.round(seconds / 2629800)} months`;
  if (seconds < 3.156e10) return `${Math.round(seconds / 31557600)} years`;
  if (seconds < 3.156e13) return `${(seconds / 3.156e10).toFixed(1)}K years`;
  return 'HEAT DEATH OF UNIVERSE';
}

function getStrength(entropy: number): { label: string; color: string; bars: number } {
  if (entropy === 0) return { label: 'NONE', color: '#444', bars: 0 };
  if (entropy < 28) return { label: 'CRITICAL', color: '#ff003c', bars: 1 };
  if (entropy < 36) return { label: 'WEAK', color: '#ff6600', bars: 2 };
  if (entropy < 50) return { label: 'MODERATE', color: '#ffd700', bars: 3 };
  if (entropy < 72) return { label: 'STRONG', color: '#00ff41', bars: 4 };
  return { label: 'MAXIMUM', color: '#00f2ff', bars: 5 };
}

export function PasswordStrengthMeter({ password }: Props) {
  const entropy = calcEntropy(password);
  const { label, color, bars } = getStrength(entropy);
  const crackTime = getCrackTime(entropy);

  if (!password) return null;

  return (
    <div className="mono" style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.75rem' }}>
      {/* Strength Bars */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '0.5rem' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1,
            height: '4px',
            borderRadius: '2px',
            background: i <= bars ? color : 'rgba(255,255,255,0.1)',
            transition: 'all 0.3s ease',
            boxShadow: i <= bars ? `0 0 4px ${color}` : 'none',
          }} />
        ))}
      </div>
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>STRENGTH</div>
          <div style={{ color, fontWeight: 700 }}>{label}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>ENTROPY</div>
          <div style={{ color: 'var(--primary)' }}>{entropy} bits</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>CRACK_TIME</div>
          <div style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>{crackTime}</div>
        </div>
      </div>
    </div>
  );
}
