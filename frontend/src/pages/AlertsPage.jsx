import { useState, useMemo } from 'react';
import EventBadge, { SeverityBadge, ProtocolBadge, getEventConfig } from '../components/EventBadge.jsx';

const TYPE_OPTS = [
  { val: 'all',              label: 'All Types' },
  { val: 'rate_limit',       label: 'Rate Limit' },
  { val: 'anomaly',          label: 'Anomaly' },
  { val: 'behavior_drift',   label: 'Behavior Drift' },
  { val: 'ip_blocked',       label: 'IP Blocked' },
  { val: 'mqtt_flood',       label: 'MQTT Flood' },
  { val: 'mqtt_anomaly',     label: 'MQTT Burst' },
  { val: 'mqtt_auth_fail',   label: 'MQTT Auth' },
  { val: 'mqtt_brute_force', label: 'MQTT Brute' },
  { val: 'mqtt_blocked',     label: 'MQTT Blocked' },
  { val: 'mqtt_oversized',   label: 'MQTT Oversize' },
];

const SEV_OPTS = [
  { val: 'all',    label: 'All Severity' },
  { val: 'HIGH',   label: 'High' },
  { val: 'MEDIUM', label: 'Medium' },
  { val: 'LOW',    label: 'Low' },
];

const PROTO_OPTS = [
  { val: 'all',  label: 'All Protocols' },
  { val: 'http', label: 'HTTP' },
  { val: 'mqtt', label: 'MQTT' },
];

function FilterChip({ active, onClick, children, accent }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px',
      background: active ? (accent === 'mqtt' ? 'rgba(56,189,248,0.15)' : 'var(--purple-muted)') : 'transparent',
      border: `1px solid ${active ? (accent === 'mqtt' ? 'rgba(56,189,248,0.4)' : 'var(--border-light)') : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      boxShadow: active ? 'var(--shadow-inset)' : 'none',
      fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: active ? 700 : 500,
      color: active ? (accent === 'mqtt' ? '#38bdf8' : '#ffffff') : 'var(--text-muted)',
      letterSpacing: '0.2px', textTransform: 'uppercase',
      cursor: 'pointer', transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
}

export default function AlertsPage({ events, metrics }) {
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [sevFilter,   setSevFilter]   = useState('all');
  const [protoFilter, setProtoFilter] = useState('all');
  const [search,      setSearch]      = useState('');
  const [sortDesc,    setSortDesc]    = useState(true);

  // events here is the 5-minute history from App.jsx
  const allEvents = Array.isArray(events) ? events : [];

  /* Summary counts */
  const counts = useMemo(() => {
    const c = { total: 0, rate_limit: 0, anomaly: 0, behavior_drift: 0, ip_blocked: 0, HIGH: 0, MEDIUM: 0, LOW: 0,
                mqtt_flood: 0, mqtt_anomaly: 0, mqtt_auth_fail: 0, mqtt_brute_force: 0, mqtt_blocked: 0, mqtt_oversized: 0 };
    allEvents.forEach(e => {
      if (!e || !e.type) return;
      c.total++;
      if (c[e.type] !== undefined) c[e.type]++;
      const sev = getEventConfig(e.type).severity;
      if (c[sev] !== undefined) c[sev]++;
    });
    return c;
  }, [allEvents]);

  /* Filtered list */
  const filtered = useMemo(() => {
    let list = [...allEvents];
    if (typeFilter  !== 'all') list = list.filter(e => e.type === typeFilter);
    if (sevFilter   !== 'all') list = list.filter(e => getEventConfig(e.type).severity === sevFilter);
    if (protoFilter !== 'all') list = list.filter(e => (e.protocol || getEventConfig(e.type).protocol) === protoFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.ip     || '').toLowerCase().includes(q) ||
        (e.device || '').toLowerCase().includes(q) ||
        (e.type   || '').toLowerCase().includes(q)
      );
    }
    // Sort by timestamp
    list.sort((a, b) => {
      const t1 = a?.timestamp || 0;
      const t2 = b?.timestamp || 0;
      return sortDesc ? t2 - t1 : t1 - t2;
    });
    return list;
  }, [allEvents, typeFilter, sevFilter, protoFilter, search, sortDesc]);

  const sevCards = [
    { key: 'HIGH',   label: 'High Severity',   color: '#ff4d6a', bg: 'rgba(255,77,106,0.08)',   border: 'rgba(255,77,106,0.3)'  },
    { key: 'MEDIUM', label: 'Medium Severity',  color: '#f5c842', bg: 'rgba(245,200,66,0.07)',   border: 'rgba(245,200,66,0.25)' },
    { key: 'LOW',    label: 'Low Severity',     color: '#3ecf8e', bg: 'rgba(62,207,142,0.07)',   border: 'rgba(62,207,142,0.25)' },
  ];

  // Protocol split counts
  const httpCount = allEvents.filter(e => (e.protocol || getEventConfig(e.type).protocol) === 'http').length;
  const mqttCount = allEvents.filter(e => (e.protocol || getEventConfig(e.type).protocol) === 'mqtt').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div className="label" style={{ color: 'var(--lime)', marginBottom: 6 }}>Intrusion Detection · 5-min history</div>
          <h1 style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 30,
            color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 8,
          }}>
            Security Alerts
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {counts.total} event{counts.total !== 1 ? 's' : ''} · <span style={{ color: '#9b8fbc' }}>HTTP: {httpCount}</span> · <span style={{ color: '#38bdf8' }}>MQTT: {mqttCount}</span>
          </p>
        </div>

        {/* Protocol split pill */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          padding: '14px 20px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', flexShrink: 0,
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="label" style={{ marginBottom: 4 }}>HTTP</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 28, color: '#9b8fbc', lineHeight: 1 }}>{httpCount}</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
          <div style={{ textAlign: 'center' }}>
            <div className="label" style={{ marginBottom: 4 }}>MQTT</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 28, color: '#38bdf8', lineHeight: 1 }}>{mqttCount}</div>
          </div>
        </div>
      </div>

      {/* ── Severity summary cards ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {sevCards.map(({ key, label, color, bg, border }, idx) => (
          <div key={key}
            className={`card-${idx + 1}`}
            onClick={() => setSevFilter(sevFilter === key ? 'all' : key)}
            style={{
              background: sevFilter === key ? bg : 'var(--bg-card)',
              border: `1px solid ${sevFilter === key ? border : 'var(--border)'}`,
              borderLeft: `4px solid ${color}`,
              borderRadius: 'var(--radius-md)', padding: '20px 24px',
              boxShadow: 'var(--shadow-card)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = bg; e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = sevFilter === key ? bg : 'var(--bg-card)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
          >
            <div className="label" style={{ marginBottom: 8 }}>{label}</div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 42,
              color, lineHeight: 1, marginBottom: 8, letterSpacing: '-0.02em',
            }}>
              {counts[key]}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {key === 'HIGH' && (
                <>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                    Rate limits: <strong style={{ color: 'var(--text-muted)' }}>{counts.rate_limit + counts.mqtt_flood}</strong>
                  </span>
                  <span style={{ color: 'var(--border-light)' }}>·</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                    IP blocks: <strong style={{ color: 'var(--text-muted)' }}>{counts.ip_blocked + counts.mqtt_blocked}</strong>
                  </span>
                  <span style={{ color: 'var(--border-light)' }}>·</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                    Auth fails: <strong style={{ color: 'var(--text-muted)' }}>{counts.mqtt_auth_fail + counts.mqtt_brute_force}</strong>
                  </span>
                </>
              )}
              {key === 'MEDIUM' && (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                  HTTP: <strong style={{ color: 'var(--text-muted)' }}>{counts.anomaly}</strong>
                  {' '}· MQTT: <strong style={{ color: 'var(--text-muted)' }}>{counts.mqtt_anomaly + counts.mqtt_oversized}</strong>
                </span>
              )}
              {key === 'LOW' && (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                  No immediate action required
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '14px 20px',
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: 'var(--shadow-surface)',
      }}>
        {/* Row 1: protocol + severity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="label" style={{ marginRight: 2, whiteSpace: 'nowrap' }}>Protocol</span>
          {PROTO_OPTS.map(o => (
            <FilterChip key={o.val} active={protoFilter === o.val} accent={o.val === 'mqtt' ? 'mqtt' : undefined} onClick={() => setProtoFilter(o.val)}>
              {o.label}
            </FilterChip>
          ))}
          <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0, margin: '0 4px' }} />
          <span className="label" style={{ marginRight: 2, whiteSpace: 'nowrap' }}>Severity</span>
          {SEV_OPTS.map(o => (
            <FilterChip key={o.val} active={sevFilter === o.val} onClick={() => setSevFilter(o.val)}>
              {o.label}
            </FilterChip>
          ))}

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search IP, device, type…"
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '7px 12px 7px 32px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 400,
                width: 220,
              }}
            />
          </div>

          <button onClick={() => setSortDesc(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
            color: 'var(--text-muted)', letterSpacing: '0.2px', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
            {sortDesc ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>

        {/* Row 2: event type chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="label" style={{ marginRight: 4, whiteSpace: 'nowrap' }}>Type</span>
          {TYPE_OPTS.map(o => (
            <FilterChip key={o.val} active={typeFilter === o.val}
              accent={o.val.startsWith('mqtt') ? 'mqtt' : undefined}
              onClick={() => setTypeFilter(o.val)}>
              {o.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* ── Events table ────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Head */}
        <div style={{
          display: 'grid', gridTemplateColumns: '210px 160px 150px 1fr 110px 80px',
          padding: '12px 20px',
          background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600,
          color: 'var(--text-dim)', letterSpacing: '0.25px', textTransform: 'uppercase',
        }}>
          <span>Type · Protocol</span>
          <span>IP Address</span>
          <span>Device</span>
          <span>Details</span>
          <span>Severity</span>
          <span style={{ textAlign: 'right' }}>Time</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '64px 20px', gap: 14, color: 'var(--text-dim)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 500 }}>
              {search || typeFilter !== 'all' || sevFilter !== 'all' || protoFilter !== 'all'
                ? 'No events match your filters.'
                : 'No security events recorded yet.'}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14 }}>
              Use the simulation console on Overview to generate events.
            </div>
          </div>
        ) : (
          filtered.map((ev, i) => {
            const cfg = getEventConfig(ev.type);
            const proto = ev.protocol || cfg.protocol;
            const isLast = i === filtered.length - 1;
            return (
              <div key={`${ev.timestamp}-${ev.type}-${ev.ip}-${i}`} style={{
                display: 'grid', gridTemplateColumns: '210px 160px 150px 1fr 110px 80px',
                padding: '12px 20px', alignItems: 'center',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                transition: 'background 0.12s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(106,95,193,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <EventBadge type={ev.type} />
                  <ProtocolBadge protocol={proto} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: cfg.color, boxShadow: `0 0 7px ${cfg.color}88`,
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {ev.ip || '—'}
                  </span>
                </div>

                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)' }}>
                  {ev.device || '—'}
                </span>

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  {ev.type === 'ip_blocked' || ev.type === 'mqtt_blocked'
                    ? 'IP blocked — 30s window'
                    : ev.type === 'mqtt_oversized' && ev.size
                    ? `Payload ${ev.size}B > 1024B limit`
                    : '—'}
                </span>

                <SeverityBadge severity={cfg.severity} />

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
                  {ev.time || '—'}
                </span>
              </div>
            );
          })
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{
            padding: '10px 20px',
            background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)',
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500,
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>
              Showing <strong style={{ color: 'var(--text-muted)' }}>{filtered.length}</strong> of <strong style={{ color: 'var(--text-muted)' }}>{allEvents.length}</strong> total events
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
              5-min rolling window · auto-prunes
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
