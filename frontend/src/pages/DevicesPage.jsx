import { useMemo, useState } from 'react';
import { getEventConfig, ProtocolBadge } from '../components/EventBadge.jsx';

function RiskMeter({ score }) {
  const color = score >= 70 ? '#ff4d6a' : score >= 40 ? '#f5c842' : '#3ecf8e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`, height: '100%', background: color,
          borderRadius: 3, transition: 'width 0.6s ease',
          boxShadow: `0 0 8px ${color}66`,
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
        color, minWidth: 32, textAlign: 'right',
      }}>
        {score}
      </span>
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = {
    blocked:    { label: 'Blocked',    color: '#ff4d6a', bg: 'rgba(255,77,106,0.14)',  border: 'rgba(255,77,106,0.35)'  },
    suspicious: { label: 'Suspicious', color: '#f5c842', bg: 'rgba(245,200,66,0.12)',  border: 'rgba(245,200,66,0.3)'   },
    normal:     { label: 'Normal',     color: '#3ecf8e', bg: 'rgba(62,207,142,0.10)',  border: 'rgba(62,207,142,0.25)'  },
  }[status] || { label: 'Unknown', color: '#9b8fbc', bg: 'rgba(155,143,188,0.1)', border: 'rgba(155,143,188,0.25)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--radius-xl)',
      fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
      color: cfg.color, letterSpacing: '0.2px', textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 5px ${cfg.color}` }} />
      {cfg.label}
    </span>
  );
}

const SORT_OPTS = [
  { val: 'events',    label: 'Event Count' },
  { val: 'risk',      label: 'Risk Score'  },
  { val: 'blocks',    label: 'Blocks'      },
  { val: 'anomalies', label: 'Anomalies'   },
];

export default function DevicesPage({ events, metrics }) {
  const [sortBy,   setSortBy]   = useState('risk');
  const [selected, setSelected] = useState(null);
  const [protoFilter, setProtoFilter] = useState('all'); // 'all' | 'http' | 'mqtt'

  const allEvents = Array.isArray(events) ? events : [];

  /* Build device profiles from 5-min history */
  const devices = useMemo(() => {
    const map = {};
    allEvents.forEach(ev => {
      if (!ev || !ev.type) return;
      const ip = ev.ip || 'unknown';
      if (!map[ip]) {
        map[ip] = {
          ip,
          linkedDevices: new Set(),
          events: 0,
          // HTTP
          rateLimits: 0, anomalies: 0, blocks: 0,
          // MQTT
          mqttFloods: 0, mqttAnomalies: 0, mqttBlocks: 0, mqttAuthFails: 0,
          // shared
          lastSeen: '—', eventLog: [],
          protocols: new Set(),
        };
      }
      const d = map[ip];
      if (ev.device) d.linkedDevices.add(ev.device);
      d.events++;
      const proto = ev.protocol || getEventConfig(ev.type).protocol;
      d.protocols.add(proto);

      // HTTP
      if (ev.type === 'rate_limit') d.rateLimits++;
      if (ev.type === 'anomaly')    d.anomalies++;
      if (ev.type === 'ip_blocked') d.blocks++;
      // MQTT
      if (ev.type === 'mqtt_flood')       d.mqttFloods++;
      if (ev.type === 'mqtt_anomaly')     d.mqttAnomalies++;
      if (ev.type === 'mqtt_blocked')     d.mqttBlocks++;
      if (ev.type === 'mqtt_auth_fail' || ev.type === 'mqtt_brute_force') d.mqttAuthFails++;

      d.lastSeen = ev.time || d.lastSeen;
      d.eventLog.push(ev);
    });

    return Object.values(map)
      .filter(d => protoFilter === 'all' || d.protocols.has(protoFilter))
      .map(d => {
        const sortedLog = [...d.eventLog].sort((a, b) => a.timestamp - b.timestamp);

        return {
          ...d,
          eventLog: sortedLog,
          linkedDevices: [...d.linkedDevices],
          protocols: [...d.protocols],
          totalBlocks: d.blocks + d.mqttBlocks,
          totalAnomalies: d.anomalies + d.mqttAnomalies + d.rateLimits + d.mqttFloods,
          status: (d.blocks + d.mqttBlocks) > 0 ? 'blocked'
            : (d.rateLimits + d.anomalies + d.mqttFloods + d.mqttAnomalies + d.mqttAuthFails) > 0 ? 'suspicious'
            : 'normal',
          riskScore: Math.min(100, Math.round(
            d.rateLimits * 25 +
            d.anomalies * 15 +
            d.blocks * 30 +

            d.mqttFloods * 25 +
            d.mqttAnomalies * 15 +
            d.mqttBlocks * 30 +
            d.mqttAuthFails * 25 +

            Math.min(d.events, 20) * 2
          )),
        };
      })
      .sort((a, b) => {
        if (sortBy === 'events')    return b.events - a.events;
        if (sortBy === 'risk')      return b.riskScore - a.riskScore;
        if (sortBy === 'blocks')    return b.totalBlocks - a.totalBlocks;
        if (sortBy === 'anomalies') return b.totalAnomalies - a.totalAnomalies;
        return 0;
      });
  }, [allEvents, sortBy, protoFilter]);

  const statusCounts = useMemo(() => {
    const c = { blocked: 0, suspicious: 0, normal: 0 };
    devices.forEach(d => c[d.status]++);
    return c;
  }, [devices]);

  const selectedDevice = selected ? devices.find(d => d.ip === selected) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <div className="label" style={{ color: 'var(--lime)', marginBottom: 6 }}>Behavioral Analysis · 5-min history</div>
        <h1 style={{
          fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 30,
          color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 8,
        }}>
          Device Intelligence
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {devices.length} unique IP{devices.length !== 1 ? 's' : ''} profiled · HTTP + MQTT risk scoring · auto-prunes after 5 min.
        </p>
      </div>

      {/* ── Summary row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Devices',   value: devices.length,          color: '#38bdf8', idx: 1 },
          { label: 'Blocked IPs',     value: statusCounts.blocked,    color: '#ff4d6a', idx: 2 },
          { label: 'Suspicious IPs',  value: statusCounts.suspicious, color: '#f5c842', idx: 3 },
          { label: 'Clean IPs',       value: statusCounts.normal,     color: '#3ecf8e', idx: 4 },
        ].map(({ label, value, color, idx }) => (
          <div key={label} className={`card-${idx}`} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderTop: `2px solid ${color}`,
            borderRadius: 'var(--radius-md)', padding: '20px 24px',
            boxShadow: 'var(--shadow-card)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -20, right: -20, width: 80, height: 80,
              borderRadius: '50%', background: color, opacity: 0.06, filter: 'blur(16px)',
            }} />
            <div className="label" style={{ marginBottom: 8 }}>{label}</div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 42,
              color, lineHeight: 1, letterSpacing: '-0.02em',
            }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Main content: table + detail panel ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16, alignItems: 'start' }}>

        {/* Table */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}>
          {/* Sort + proto bar */}
          <div style={{
            padding: '14px 20px',
            background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span className="label" style={{ marginRight: 4 }}>Sort by</span>
            {SORT_OPTS.map(({ val, label }) => (
              <button key={val} onClick={() => setSortBy(val)} style={{
                padding: '4px 12px',
                background: sortBy === val ? 'var(--purple-muted)' : 'transparent',
                border: `1px solid ${sortBy === val ? 'var(--border-light)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: sortBy === val ? 700 : 500,
                color: sortBy === val ? '#fff' : 'var(--text-muted)',
                letterSpacing: '0.2px', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.14s',
              }}>
                {label}
              </button>
            ))}

            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

            <span className="label" style={{ marginRight: 4 }}>Protocol</span>
            {[{v:'all',l:'All'},{v:'http',l:'HTTP'},{v:'mqtt',l:'MQTT'}].map(({v,l}) => (
              <button key={v} onClick={() => setProtoFilter(v)} style={{
                padding: '4px 12px',
                background: protoFilter === v ? (v === 'mqtt' ? 'rgba(56,189,248,0.15)' : 'var(--purple-muted)') : 'transparent',
                border: `1px solid ${protoFilter === v ? (v === 'mqtt' ? 'rgba(56,189,248,0.4)' : 'var(--border-light)') : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: protoFilter === v ? 700 : 500,
                color: protoFilter === v ? (v === 'mqtt' ? '#38bdf8' : '#fff') : 'var(--text-muted)',
                letterSpacing: '0.2px', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.14s',
              }}>{l}</button>
            ))}
          </div>

          {/* Table head */}
          <div style={{
            display: 'grid', gridTemplateColumns: '160px 110px 70px 70px 80px 80px 1fr 90px',
            padding: '10px 20px',
            fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600,
            color: 'var(--text-dim)', letterSpacing: '0.25px', textTransform: 'uppercase',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>IP Address</span><span>Status</span>
            <span>Proto</span><span>Events</span>
            <span>Alerts</span><span>Blocks</span>
            <span>Risk Score</span><span style={{ textAlign: 'right' }}>Last Seen</span>
          </div>

          {devices.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '64px 20px', gap: 14, color: 'var(--text-dim)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}>
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 500 }}>No device activity recorded yet.</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14 }}>Send requests via the Overview console to start tracking.</div>
            </div>
          ) : (
            devices.map((d, i) => {
              const isSelected = selected === d.ip;
              const isLast = i === devices.length - 1;
              return (
                <div key={d.ip}
                  onClick={() => setSelected(isSelected ? null : d.ip)}
                  style={{
                    display: 'grid', gridTemplateColumns: '160px 110px 70px 70px 80px 80px 1fr 90px',
                    padding: '14px 20px', alignItems: 'center',
                    background: isSelected ? 'rgba(106,95,193,0.12)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                    borderLeft: isSelected ? '3px solid var(--purple)' : '3px solid transparent',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(106,95,193,0.06)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'; }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>
                      {d.ip}
                    </div>
                    {d.linkedDevices.length > 0 && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-dim)' }}>
                        {d.linkedDevices.slice(0, 2).join(', ')}{d.linkedDevices.length > 2 ? ` +${d.linkedDevices.length - 2}` : ''}
                      </div>
                    )}
                  </div>

                  <StatusPill status={d.status} />

                  {/* Protocol indicators */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {d.protocols.includes('http') && <ProtocolBadge protocol="http" />}
                    {d.protocols.includes('mqtt') && <ProtocolBadge protocol="mqtt" />}
                  </div>

                  <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 18, color: 'var(--text-secondary)' }}>
                    {d.events}
                  </span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 18, color: d.totalAnomalies > 0 ? '#f5c842' : 'var(--text-dim)' }}>
                    {d.totalAnomalies}
                  </span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 18, color: d.totalBlocks > 0 ? '#ff4d6a' : 'var(--text-dim)' }}>
                    {d.totalBlocks}
                  </span>

                  <RiskMeter score={d.riskScore} />

                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
                    {d.lastSeen}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        {selectedDevice && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--purple)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
            boxShadow: 'rgba(106,95,193,0.2) 0px 8px 32px',
            position: 'sticky', top: 24,
          }}>
            <div style={{
              padding: '16px 20px', background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div className="label" style={{ color: 'var(--lime)', marginBottom: 3 }}>Device Profile</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedDevice.ip}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28,
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
              }}>×</button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <StatusPill status={selectedDevice.status} />
                {selectedDevice.protocols.map(p => <ProtocolBadge key={p} protocol={p} />)}
              </div>

              {/* Risk score */}
              <div style={{ marginBottom: 20 }}>
                <div className="label" style={{ marginBottom: 8 }}>Risk Score</div>
                <RiskMeter score={selectedDevice.riskScore} />
              </div>

              {/* HTTP stats */}
              {selectedDevice.protocols.includes('http') && (
                <div style={{ marginBottom: 16 }}>
                  <div className="label" style={{ marginBottom: 8, color: '#9b8fbc' }}>HTTP Activity</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {[
                      { label: 'Requests', value: selectedDevice.events - (selectedDevice.mqttFloods + selectedDevice.mqttAnomalies + selectedDevice.mqttBlocks + selectedDevice.mqttAuthFails), color: '#38bdf8' },
                      { label: 'Alerts',   value: selectedDevice.rateLimits + selectedDevice.anomalies, color: '#f5c842' },
                      { label: 'Blocked',  value: selectedDevice.blocks, color: '#ff4d6a' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: '10px 12px', textAlign: 'center',
                      }}>
                        <div className="label" style={{ marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MQTT stats */}
              {selectedDevice.protocols.includes('mqtt') && (
                <div style={{ marginBottom: 16 }}>
                  <div className="label" style={{ marginBottom: 8, color: '#38bdf8' }}>MQTT Activity</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {[
                      { label: 'Floods',    value: selectedDevice.mqttFloods,    color: '#ff4d6a' },
                      { label: 'Bursts',    value: selectedDevice.mqttAnomalies, color: '#f5c842' },
                      { label: 'Auth Fail', value: selectedDevice.mqttAuthFails, color: '#fa7faa' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)',
                        borderRadius: 'var(--radius)', padding: '10px 12px', textAlign: 'center',
                      }}>
                        <div className="label" style={{ marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked device IDs */}
              {selectedDevice.linkedDevices.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="label" style={{ marginBottom: 8 }}>Linked Device IDs</div>
                  {selectedDevice.linkedDevices.map(id => (
                    <div key={id} style={{
                      padding: '6px 10px', marginBottom: 4,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)',
                    }}>
                      {id}
                    </div>
                  ))}
                </div>
              )}

              {/* Recent event log */}
              <div style={{ marginTop: 20 }}>
                <div className="label" style={{ marginBottom: 10 }}>ATTACK TIMELINE</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedDevice.eventLog.slice(-6).map((e, i) => {
                    const cfg = getEventConfig(e.type);

                    return (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 12,
                        color: 'var(--text-muted)',
                      }}>
                        {/* dot */}
                        <div style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: cfg.color,
                          boxShadow: `0 0 6px ${cfg.color}`
                        }} />

                        {/* text */}
                        <span style={{ color: cfg.color, fontWeight: 600 }}>
                          {cfg.label}
                        </span>

                        {/* time */}
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                          {e.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── High-risk device cards ───────────────────────────────────────── */}
      {devices.filter(d => d.status !== 'normal').length > 0 && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>Priority Review</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)' }}>
              High-Risk Devices
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {devices.filter(d => d.status !== 'normal').slice(0, 6).map((d, idx) => {
              const borderColor = d.status === 'blocked' ? '#ff4d6a' : '#f5c842';
              return (
                <div key={d.ip} className={`card-${(idx % 3) + 1}`} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderLeft: `4px solid ${borderColor}`,
                  borderRadius: 'var(--radius-md)', padding: '20px',
                  boxShadow: 'var(--shadow-card)',
                  cursor: 'pointer', transition: 'box-shadow 0.15s',
                }}
                  onClick={() => setSelected(d.ip)}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                        {d.ip}
                      </div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                        {d.linkedDevices.join(', ') || 'No device ID'}
                      </div>
                    </div>
                    <StatusPill status={d.status} />
                  </div>

                  {/* Protocol badges */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                    {d.protocols.includes('http') && <ProtocolBadge protocol="http" />}
                    {d.protocols.includes('mqtt') && <ProtocolBadge protocol="mqtt" />}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div className="label" style={{ marginBottom: 6 }}>Risk Score</div>
                    <RiskMeter score={d.riskScore} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { l: 'Events', v: d.events,         c: '#38bdf8' },
                      { l: 'Alerts', v: d.totalAnomalies, c: '#f5c842' },
                      { l: 'Blocks', v: d.totalBlocks,    c: '#ff4d6a' },
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: '8px 10px', textAlign: 'center',
                      }}>
                        <div className="label" style={{ marginBottom: 2 }}>{l}</div>
                        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 20, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
