import { useState, useEffect, useRef, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Cache survives page navigation — persists for the lifetime of the app session
const _cache = { history: {}, topIPs: {} };

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--font-ui)', fontSize: 12,
      boxShadow: 'var(--shadow-elevated)',
    }}>
      {label && <div style={{ color: 'var(--text-dim)', marginBottom: 4, fontSize: 11 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

function SectionTitle({ label, title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {label && <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>{label}</div>}
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)' }}>{title}</div>
      {sub && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-dim)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage({ metrics }) {
  const [hours,     setHours]     = useState(24);
  // Initialise from cache so page shows instantly on revisit
  const [history,   setHistory]   = useState(() => _cache.history[24] || []);
  const [topIPs,    setTopIPs]    = useState(() => _cache.topIPs[24]  || []);
  const [fetching,  setFetching]  = useState(false);  // subtle indicator, not full blank
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    // Restore cache immediately when hours changes (instant, no flicker)
    if (_cache.history[hours]) setHistory(_cache.history[hours]);
    if (_cache.topIPs[hours])  setTopIPs(_cache.topIPs[hours]);

    // Then fetch fresh data in background
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setFetching(true);
    Promise.all([
      fetch(`${API}/history?hours=${hours}`,          { signal: ctrl.signal }).then(r => r.json()),
      fetch(`${API}/stats/top-ips?hours=${hours}&limit=10`, { signal: ctrl.signal }).then(r => r.json()),
    ])
      .then(([h, t]) => {
        const hist   = h.history  || [];
        const ips    = t.top_ips  || [];
        _cache.history[hours] = hist;
        _cache.topIPs[hours]  = ips;
        setHistory(hist);
        setTopIPs(ips);
      })
      .catch(() => {}) // aborted fetches silently ignored
      .finally(() => setFetching(false));

    return () => ctrl.abort();
  }, [hours]);

  // Chart data
  const chartData = useMemo(() => history.map(row => ({
    ...row,
    label: new Date(row.ts * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  })), [history]);

  const attackData = useMemo(() => history.map(row => ({
    label: new Date(row.ts * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    blocked:      row.blocked_requests,
    anomalies:    row.anomalies,
    mqtt_blocked: row.mqtt_blocked,
  })), [history]);

  const threatDist = useMemo(() => {
    const c = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    history.forEach(r => { if (c[r.threat_level] !== undefined) c[r.threat_level]++; });
    return [
      { name: 'HIGH',   value: c.HIGH,   color: '#ff4d6a' },
      { name: 'MEDIUM', value: c.MEDIUM, color: '#f5c842' },
      { name: 'LOW',    value: c.LOW,    color: '#3ecf8e' },
    ];
  }, [history]);

  const maxIP  = topIPs[0]?.count || 1;
  const noData = history.length === 0 && !fetching;

  const btnBase = {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '7px 14px', border: '1px solid', borderRadius: 'var(--radius-lg)',
    fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.2px', textTransform: 'uppercase',
    cursor: 'pointer', transition: 'box-shadow 0.15s',
  };

  async function handleExport(fmt) {
    setExporting(true);
    try {
      const res  = await fetch(`${API}/export/events?hours=${hours}&fmt=${fmt}`);
      const blob = await res.blob();
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = fmt === 'json' ? 'iot_events.json' : 'iot_events.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {}
    finally { setExporting(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <div className="label" style={{ color: 'var(--lime)', marginBottom: 6 }}>
            Persistent History · SQLite
            {fetching && <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontWeight: 400 }}>· refreshing…</span>}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 30,
            color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 8,
          }}>
            Analytics
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {history.length} data points · Trend charts, top attackers, export
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {[1, 6, 24, 72].map(h => (
            <button key={h} onClick={() => setHours(h)} style={{
              ...btnBase,
              background: hours === h ? 'var(--purple-muted)' : 'transparent',
              borderColor: hours === h ? 'var(--border-light)' : 'var(--border)',
              color: hours === h ? '#fff' : 'var(--text-muted)',
              boxShadow: hours === h ? 'var(--shadow-inset)' : 'none',
            }}>
              {h}h
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
          <button onClick={() => handleExport('csv')} disabled={exporting} style={{
            ...btnBase, background: 'transparent', borderColor: 'var(--border)', color: 'var(--lime)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV
          </button>
          <button onClick={() => handleExport('json')} disabled={exporting} style={{
            ...btnBase, background: 'transparent', borderColor: 'var(--border)', color: 'var(--cyan)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            JSON
          </button>
        </div>
      </div>

      {/* No data state — only show if truly nothing, not while loading */}
      {noData ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px 20px', gap: 14, color: 'var(--text-dim)',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 500 }}>No history yet</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14 }}>
            Metrics are snapshotted every 60 seconds. Run some simulations and come back.
          </div>
        </div>
      ) : (
        <>
          {/* Traffic trend chart */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <SectionTitle label="Traffic Trend" title="Request Volume Over Time" />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {[{ c: '#38bdf8', l: 'HTTP Requests' }, { c: '#00bfa5', l: 'MQTT Publishes' }, { c: '#ff4d6a', l: 'Blocked' }].map(({ c, l }) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 3, background: c, borderRadius: 2 }} />
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/><stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gMqtt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00bfa5" stopOpacity={0.15}/><stop offset="95%" stopColor="#00bfa5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gBlk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff4d6a" stopOpacity={0.18}/><stop offset="95%" stopColor="#ff4d6a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(106,95,193,0.08)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-ui)' }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-ui)' }} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="total_requests"   name="HTTP Requests"   stroke="#38bdf8" strokeWidth={1.5} fill="url(#gReq)"  dot={false} />
                <Area type="monotone" dataKey="mqtt_total"       name="MQTT Publishes"  stroke="#00bfa5" strokeWidth={1.5} fill="url(#gMqtt)" dot={false} />
                <Area type="monotone" dataKey="blocked_requests" name="Blocked"          stroke="#ff4d6a" strokeWidth={1.5} fill="url(#gBlk)"  dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Attack timeline + Threat dist */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-card)',
            }}>
              <SectionTitle label="Attack Timeline" title="Security Events Over Time" />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={attackData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(106,95,193,0.08)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 9 }} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="blocked"      name="Blocked"      fill="#ff4d6a" radius={[2, 2, 0, 0]} maxBarSize={12} />
                  <Bar dataKey="anomalies"    name="Anomalies"    fill="#f5c842" radius={[2, 2, 0, 0]} maxBarSize={12} />
                  <Bar dataKey="mqtt_blocked" name="MQTT Blocked" fill="#ff8c42" radius={[2, 2, 0, 0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Threat distribution */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-card)',
            }}>
              <SectionTitle label="Threat Distribution" title="By Level" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                {threatDist.map(({ name, value, color }) => {
                  const total = history.length || 1;
                  const pct   = Math.round((value / total) * 100);
                  return (
                    <div key={name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color }}>{name}</span>
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 3 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
                        {pct}% of snapshots
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top attacking IPs */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <SectionTitle
                label="Top Attackers"
                title={`Top IPs by Event Count — Last ${hours}h`}
                sub="Sourced from persistent SQLite storage, survives backend restarts"
              />
            </div>
            {topIPs.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-dim)' }}>
                No events recorded in the last {hours}h
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 120px 200px',
                  padding: '10px 24px', background: 'var(--bg-elevated)',
                  fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600,
                  color: 'var(--text-dim)', letterSpacing: '0.25px', textTransform: 'uppercase',
                }}>
                  <span>#</span><span>IP Address</span><span>Events</span><span>Relative Volume</span>
                </div>
                {topIPs.map((ip, i) => {
                  const pct   = Math.round((ip.count / maxIP) * 100);
                  const color = i === 0 ? '#ff4d6a' : i === 1 ? '#ff8c42' : i < 5 ? '#f5c842' : '#9b8fbc';
                  return (
                    <div key={ip.ip} style={{
                      display: 'grid', gridTemplateColumns: '40px 1fr 120px 200px',
                      padding: '12px 24px', alignItems: 'center',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(106,95,193,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                    >
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: i < 3 ? color : 'var(--text-dim)' }}>
                        {i + 1}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{ip.ip}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 700, color }}>{ip.count}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 3 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', width: 36, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
