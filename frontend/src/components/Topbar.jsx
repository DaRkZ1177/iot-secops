const PAGE_LABELS = {
  overview: 'Security Overview',
  alerts:   'Security Alerts',
  devices:  'Device Intelligence',
};

export default function Topbar({ metrics, error, lastAt, onRefresh, page }) {
  const tl = metrics?.threat_level || 'LOW';

  const tlConfig = {
    HIGH: {
      color: 'var(--red)', bg: 'rgba(255,77,106,0.10)',
      border: 'rgba(255,77,106,0.35)',
      label: '⚠ CRITICAL — ACTIVE THREAT',
      pulse: true,
    },
    MEDIUM: {
      color: 'var(--yellow)', bg: 'rgba(245,200,66,0.08)',
      border: 'rgba(245,200,66,0.3)',
      label: '◈ ELEVATED — SUSPICIOUS ACTIVITY',
      pulse: false,
    },
    LOW: {
      color: 'var(--lime)', bg: 'rgba(194,239,78,0.07)',
      border: 'rgba(194,239,78,0.25)',
      label: '◉ NOMINAL — SYSTEMS SECURE',
      pulse: false,
    },
  }[tl] || { color: 'var(--text-muted)', bg: 'transparent', border: 'var(--border)', label: '— OFFLINE', pulse: false };

  const timeStr = lastAt
    ? lastAt.toLocaleTimeString('en-US', { hour12: false })
    : '--:--:--';

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--bg-deep)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 40px', gap: 20,
      position: 'sticky', top: 0, zIndex: 40,
      boxShadow: 'rgba(22,15,36,0.5) 0px 2px 8px',
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 10,
          color: 'var(--text-dim)', letterSpacing: '0.25px', textTransform: 'uppercase',
        }}>
          IOT-SECOPS
        </span>
        <span style={{ color: 'var(--border-light)', fontSize: 14 }}>/</span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
          color: 'var(--text-primary)',
        }}>
          {PAGE_LABELS[page] || 'Dashboard'}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Threat level pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px',
        background: tlConfig.bg,
        border: `1px solid ${tlConfig.border}`,
        borderRadius: 'var(--radius-lg)',
        animation: tlConfig.pulse ? 'threat-pulse 1.5s ease infinite' : 'none',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: tlConfig.color,
          boxShadow: `0 0 8px ${tlConfig.color}`,
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
          color: tlConfig.color, letterSpacing: '0.2px', textTransform: 'uppercase',
        }}>
          {tlConfig.label}
        </span>
      </div>

      {/* Live indicator */}
      {!error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="live-dot" />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--text-muted)', letterSpacing: '0.05em',
          }}>
            {timeStr}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)' }} />
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
            color: 'var(--red)', letterSpacing: '0.2px', textTransform: 'uppercase',
          }}>
            Backend Offline
          </span>
        </div>
      )}

      {/* Refresh btn — DESIGN.md muted purple button */}
      <button
        onClick={onRefresh}
        title="Refresh now"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px',
          background: 'var(--purple-muted)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-inset)',
          color: '#ffffff',
          fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.2px', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'box-shadow 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-inset)'; }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
    </header>
  );
}
