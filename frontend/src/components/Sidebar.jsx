const NAV = [
  {
    id: 'overview', label: 'Overview',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: 'alerts', label: 'Alerts', badge: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    id: 'devices', label: 'Devices',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    id: 'analytics', label: 'Analytics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
];

const SYSTEM_STATUS = [
  { label: 'HTTP Gateway',   active: true },
  { label: 'Rate Limiter',   active: true },
  { label: 'Anomaly Engine', active: true },
  { label: 'MQTT Broker',    active: true },
  { label: 'SQLite DB',      active: true },
];

export default function Sidebar({ page, setPage, metrics, alertsSeen, onAlertsView, user, onLogout }) {
  const totalAlerts = metrics?.blocked_requests || 0;
  const unseenCount = Math.max(0, totalAlerts - alertsSeen);

  return (
    <aside style={{
      width: 'var(--sidebar-w)', height: '100vh',
      position: 'fixed', top: 0, left: 0,
      background: 'var(--bg-deep)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius)',
            background: 'linear-gradient(135deg, var(--purple-deep) 0%, var(--purple) 100%)',
            border: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: 'rgba(106,95,193,0.35) 0px 4px 16px',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              IoT SecOps
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--lime)', letterSpacing: '0.2em', marginTop: 2, textTransform: 'uppercase' }}>
              // SOC v2.0
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
        <div className="label" style={{ padding: '0 8px', marginBottom: 8 }}>Navigation</div>

        {NAV.map(({ id, label, icon, badge }) => {
          const active    = page === id;
          const showBadge = badge && unseenCount > 0;
          return (
            <button key={id}
              onClick={() => { setPage(id); if (id === 'alerts') onAlertsView(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 12px',
                background: active ? 'rgba(106,95,193,0.15)' : 'transparent',
                border: active ? '1px solid rgba(106,95,193,0.25)' : '1px solid transparent',
                borderRadius: 'var(--radius)',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', fontWeight: active ? 600 : 400,
                fontSize: 15, letterSpacing: '0.01em',
                cursor: 'pointer', marginBottom: 2,
                transition: 'all 0.15s ease', position: 'relative', textAlign: 'left',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}}
            >
              {active && <div className="nav-active-bar" />}
              <span style={{ opacity: active ? 1 : 0.65, color: active ? 'var(--lime)' : 'currentColor', flexShrink: 0 }}>
                {icon}
              </span>
              <span style={{ flex: 1 }}>{label}</span>
              {showBadge && (
                <span style={{
                  background: 'var(--red)', color: '#fff',
                  fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 'var(--radius-xl)',
                  letterSpacing: '0.05em', lineHeight: 1.6,
                }}>
                  {unseenCount > 99 ? '99+' : unseenCount}
                </span>
              )}
            </button>
          );
        })}

        {/* System status */}
        <div style={{ height: 1, background: 'var(--border)', margin: '20px 4px 16px' }} />
        <div className="label" style={{ padding: '0 8px', marginBottom: 10 }}>System Status</div>
        {SYSTEM_STATUS.map(({ label, active }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px' }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: active ? 'var(--lime)' : 'var(--border-light)',
              boxShadow: active ? '0 0 8px rgba(194,239,78,0.7)' : 'none',
            }} />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: active ? 'var(--text-secondary)' : 'var(--text-dim)' }}>
              {label}
            </span>
          </div>
        ))}
      </nav>

      {/* User strip + logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', marginBottom: 8,
          }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--purple-deep), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 12, color: '#fff',
            }}>
              {(user.username || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
                color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.username}
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 600,
                color: 'var(--lime)', textTransform: 'uppercase', letterSpacing: '0.2px',
              }}>
                {user.role}
              </div>
            </div>
            {/* Logout */}
            <button onClick={onLogout} title="Sign out" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26,
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-dim)',
              cursor: 'pointer', flexShrink: 0, transition: 'all 0.14s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,77,106,0.08)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(255,77,106,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        )}

        {/* Polling indicator */}
        <div style={{
          padding: '8px 12px',
          background: 'rgba(194,239,78,0.07)', border: '1px solid rgba(194,239,78,0.2)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, color: 'var(--lime)', textTransform: 'uppercase', letterSpacing: '0.2px', marginBottom: 2 }}>
            Polling Active
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
            4s refresh · HTTP + MQTT
          </div>
        </div>
      </div>
    </aside>
  );
}
