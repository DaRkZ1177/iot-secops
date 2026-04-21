import { useState, useMemo } from 'react';
import EventBadge, {
  SeverityBadge, ProtocolBadge, DeviceTypeBadge,
  BehaviorIndicator, getEventConfig, generateAttackStory,
} from '../components/EventBadge.jsx';

const TYPE_OPTS = [
  { val: 'all',              label: 'All Types' },
  { val: 'rate_limit',       label: 'Rate Limit' },
  { val: 'anomaly',          label: 'Anomaly' },
  { val: 'behavior_drift',   label: 'Drift' },
  { val: 'ip_blocked',       label: 'IP Blocked' },
  { val: 'mqtt_flood',       label: 'MQTT Flood' },
  { val: 'mqtt_anomaly',     label: 'MQTT Burst' },
  { val: 'mqtt_auth_fail',   label: 'MQTT Auth' },
  { val: 'mqtt_brute_force', label: 'MQTT Brute' },
  { val: 'mqtt_blocked',     label: 'MQTT Blocked' },
  { val: 'mqtt_oversized',   label: 'Oversized' },
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

const DEVICE_TYPE_OPTS = [
  { val: 'all',        label: 'All Devices' },
  { val: 'cctv',       label: '📷 CCTV' },
  { val: 'hvac',       label: '🌡 HVAC' },
  { val: 'smart_lock', label: '🔐 Smart Lock' },
  { val: 'sensor',     label: '📡 Sensor' },
  { val: 'gateway',    label: '🔀 Gateway' },
];

// High-severity event types for anomaly detection
const ANOMALOUS_TYPES = new Set([
  'rate_limit', 'ip_blocked', 'mqtt_flood',
  'mqtt_brute_force', 'mqtt_blocked', 'mqtt_auth_fail',
]);

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
      cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  );
}

export default function AlertsPage({ events, metrics }) {
  const [typeFilter,       setTypeFilter]       = useState('all');
  const [sevFilter,        setSevFilter]        = useState('all');
  const [protoFilter,      setProtoFilter]      = useState('all');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('all');
  const [search,           setSearch]           = useState('');
  const [sortDesc,         setSortDesc]         = useState(true);
  const [expandedRow,      setExpandedRow]      = useState(null);

  const allEvents = Array.isArray(events) ? events : [];

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

  const filtered = useMemo(() => {
    let list = [...allEvents];
    if (typeFilter       !== 'all') list = list.filter(e => e.type === typeFilter);
    if (sevFilter        !== 'all') list = list.filter(e => getEventConfig(e.type).severity === sevFilter);
    if (protoFilter      !== 'all') list = list.filter(e => (e.protocol || getEventConfig(e.type).protocol) === protoFilter);
    if (deviceTypeFilter !== 'all') list = list.filter(e => (e.device_type || 'unknown') === deviceTypeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.ip          || '').toLowerCase().includes(q) ||
        (e.device      || '').toLowerCase().includes(q) ||
        (e.type        || '').toLowerCase().includes(q) ||
        (e.device_type || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => sortDesc ? (b.timestamp || 0) - (a.timestamp || 0) : (a.timestamp || 0) - (b.timestamp || 0));
    return list;
  }, [allEvents, typeFilter, sevFilter, protoFilter, deviceTypeFilter, search, sortDesc]);

  const httpCount = allEvents.filter(e => (e.protocol || getEventConfig(e.type).protocol) === 'http').length;
  const mqttCount = allEvents.filter(e => (e.protocol || getEventConfig(e.type).protocol) === 'mqtt').length;

  // Device type breakdown
  const deviceTypeCounts = useMemo(() => {
    const c = {};
    allEvents.forEach(e => {
      const dt = e.device_type || 'unknown';
      c[dt] = (c[dt] || 0) + 1;
    });
    return c;
  }, [allEvents]);

  const sevCards = [
    { key: 'HIGH',   label: 'High Severity',  color: '#ff4d6a', bg: 'rgba(255,77,106,0.08)',  border: 'rgba(255,77,106,0.3)'  },
    { key: 'MEDIUM', label: 'Medium Severity', color: '#f5c842', bg: 'rgba(245,200,66,0.07)',  border: 'rgba(245,200,66,0.25)' },
    { key: 'LOW',    label: 'Low Severity',    color: '#3ecf8e', bg: 'rgba(62,207,142,0.07)',  border: 'rgba(62,207,142,0.25)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div className="label" style={{ color: 'var(--lime)', marginBottom: 6 }}>Intrusion Detection · 5-min history</div>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 30, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 8 }}>
            Security Alerts
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {counts.total} event{counts.total !== 1 ? 's' : ''} · <span style={{ color: '#9b8fbc' }}>HTTP: {httpCount}</span> · <span style={{ color: '#38bdf8' }}>MQTT: {mqttCount}</span>
          </p>
        </div>

        {/* Protocol split */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', flexShrink: 0, boxShadow: 'var(--shadow-card)' }}>
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

      {/* ── Severity cards ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {sevCards.map(({ key, label, color, bg, border }, idx) => (
          <div key={key} className={`card-${idx + 1}`}
            onClick={() => setSevFilter(sevFilter === key ? 'all' : key)}
            style={{ background: sevFilter === key ? bg : 'var(--bg-card)', border: `1px solid ${sevFilter === key ? border : 'var(--border)'}`, borderLeft: `4px solid ${color}`, borderRadius: 'var(--radius-md)', padding: '20px 24px', boxShadow: 'var(--shadow-card)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = bg; e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = sevFilter === key ? bg : 'var(--bg-card)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
          >
            <div className="label" style={{ marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 42, color, lineHeight: 1, marginBottom: 8, letterSpacing: '-0.02em' }}>{counts[key]}</div>
            {key === 'HIGH' && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                Rate limits: <strong style={{ color: 'var(--text-muted)' }}>{counts.rate_limit + counts.mqtt_flood}</strong>
                {' '}· Blocks: <strong style={{ color: 'var(--text-muted)' }}>{counts.ip_blocked + counts.mqtt_blocked}</strong>
                {' '}· Auth: <strong style={{ color: 'var(--text-muted)' }}>{counts.mqtt_auth_fail + counts.mqtt_brute_force}</strong>
              </div>
            )}
            {key === 'MEDIUM' && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                Anomalies: <strong style={{ color: 'var(--text-muted)' }}>{counts.anomaly}</strong>
                {' '}· Drift: <strong style={{ color: 'var(--text-muted)' }}>{counts.behavior_drift}</strong>
                {' '}· MQTT: <strong style={{ color: 'var(--text-muted)' }}>{counts.mqtt_anomaly + counts.mqtt_oversized}</strong>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'var(--shadow-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="label" style={{ marginRight: 2, whiteSpace: 'nowrap' }}>Protocol</span>
          {PROTO_OPTS.map(o => <FilterChip key={o.val} active={protoFilter === o.val} accent={o.val === 'mqtt' ? 'mqtt' : undefined} onClick={() => setProtoFilter(o.val)}>{o.label}</FilterChip>)}
          <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0, margin: '0 4px' }} />
          <span className="label" style={{ marginRight: 2, whiteSpace: 'nowrap' }}>Severity</span>
          {SEV_OPTS.map(o => <FilterChip key={o.val} active={sevFilter === o.val} onClick={() => setSevFilter(o.val)}>{o.label}</FilterChip>)}
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search IP, device, type…" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 12px 7px 32px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 13, width: 220 }} />
          </div>
          <button onClick={() => setSortDesc(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.2px', textTransform: 'uppercase', cursor: 'pointer' }}>
            {sortDesc ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="label" style={{ marginRight: 4, whiteSpace: 'nowrap' }}>Type</span>
          {TYPE_OPTS.map(o => <FilterChip key={o.val} active={typeFilter === o.val} accent={o.val.startsWith('mqtt') ? 'mqtt' : undefined} onClick={() => setTypeFilter(o.val)}>{o.label}</FilterChip>)}
        </div>

        {/* NEW: Device type filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="label" style={{ marginRight: 4, whiteSpace: 'nowrap' }}>Device</span>
          {DEVICE_TYPE_OPTS.map(o => (
            <FilterChip key={o.val} active={deviceTypeFilter === o.val} onClick={() => setDeviceTypeFilter(o.val)}>
              {o.label}{o.val !== 'all' && deviceTypeCounts[o.val] ? ` (${deviceTypeCounts[o.val]})` : ''}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* ── Events table ─────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 80px 110px 130px 110px 1fr 80px', padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.25px', textTransform: 'uppercase' }}>
          <span>Type</span>
          <span>Protocol</span>
          <span>Device Type</span>
          <span>IP Address</span>
          <span>Behavior</span>
          <span>Attack Story</span>
          <span style={{ textAlign: 'right' }}>Time</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', gap: 14, color: 'var(--text-dim)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 500 }}>
              {search || typeFilter !== 'all' || sevFilter !== 'all' || protoFilter !== 'all' || deviceTypeFilter !== 'all'
                ? 'No events match your filters.'
                : 'No security events recorded yet.'}
            </div>
          </div>
        ) : filtered.map((ev, i) => {
          const cfg      = getEventConfig(ev.type);
          const proto    = ev.protocol || cfg.protocol;
          const isAnom   = ANOMALOUS_TYPES.has(ev.type);
          const story    = generateAttackStory(ev);
          const ts       = ev.timestamp ? new Date(ev.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
          const isLast   = i === filtered.length - 1;
          const expanded = expandedRow === i;

          return (
            <div key={`${ev.timestamp}-${ev.type}-${ev.ip}-${i}`}>
              <div
                onClick={() => setExpandedRow(expanded ? null : i)}
                style={{ display: 'grid', gridTemplateColumns: '160px 80px 110px 130px 110px 1fr 80px', padding: '12px 20px', alignItems: 'center', background: expanded ? 'rgba(106,95,193,0.1)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom: isLast && !expanded ? 'none' : '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(106,95,193,0.06)'; }}
                onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'; }}
              >
                <EventBadge type={ev.type} />
                <ProtocolBadge protocol={proto} />
                <DeviceTypeBadge device_type={ev.device_type || 'unknown'} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: cfg.color, boxShadow: `0 0 7px ${cfg.color}88` }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{ev.ip || '—'}</span>
                </div>
                <BehaviorIndicator isAnomalous={isAnom} />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, paddingRight: 8 }}>{story}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>{ts}</span>
              </div>

              {/* Expanded detail row */}
              {expanded && (
                <div style={{ padding: '12px 20px 16px', background: 'rgba(106,95,193,0.06)', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 800, marginBottom: 8 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Analysis: </strong>{story}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>device: {ev.device || '—'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>timestamp: {ev.timestamp?.toFixed(3)}</span>
                    {ev.remaining && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff8c42' }}>block remaining: {ev.remaining}s</span>}
                    {ev.size && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4d6a' }}>payload size: {ev.size}B</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length > 0 && (
          <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Showing <strong style={{ color: 'var(--text-muted)' }}>{filtered.length}</strong> of <strong style={{ color: 'var(--text-muted)' }}>{allEvents.length}</strong> total events</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Click any row to expand · 5-min rolling window</span>
          </div>
        )}
      </div>
    </div>
  );
}
