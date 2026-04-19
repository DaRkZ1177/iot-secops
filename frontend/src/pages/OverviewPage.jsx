import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import StatCard from '../components/StatCard.jsx';
import EventBadge, { getEventConfig, ProtocolBadge } from '../components/EventBadge.jsx';

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'var(--font-ui)', fontSize: 12,
      boxShadow: 'var(--shadow-elevated)',
    }}>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ children, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>▸ {children}</div>
      {sub && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-dim)', fontWeight: 400 }}>{sub}</p>}
    </div>
  );
}

function ActionBtn({ onClick, color = 'purple', children, disabled }) {
  const styles = {
    purple: { bg: 'var(--purple-muted)', border: 'var(--border-light)', color: '#fff' },
    red:    { bg: 'rgba(255,77,106,0.15)', border: 'rgba(255,77,106,0.4)', color: '#ff4d6a' },
    yellow: { bg: 'rgba(245,200,66,0.12)', border: 'rgba(245,200,66,0.35)', color: '#f5c842' },
    cyan:   { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)', color: '#38bdf8' },
    pink:   { bg: 'rgba(250,127,170,0.12)', border: 'rgba(250,127,170,0.35)', color: '#fa7faa' },
    ghost:  { bg: 'rgba(255,255,255,0.04)', border: 'var(--border)', color: 'var(--text-muted)' },
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '10px 16px',
        background: disabled ? 'rgba(255,255,255,0.03)' : styles.bg,
        border: `1px solid ${disabled ? 'var(--border)' : styles.border}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: (!disabled && color === 'purple') ? 'var(--shadow-inset)' : 'none',
        color: disabled ? 'var(--text-dim)' : styles.color,
        fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.2px', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'box-shadow 0.15s, background 0.15s',
        textAlign: 'left',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.boxShadow = (color === 'purple') ? 'var(--shadow-inset)' : 'none'; }}
    >
      {children}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function OverviewPage({ metrics, events, api, onRefresh }) {
  const m  = metrics || {};
  const tl = m.threat_level || 'LOW';
  const [httpStatus, setHttpStatus] = useState('');
  const [mqttStatus, setMqttStatus] = useState('');
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (!metrics) return;

    setChartData(prev => {
      const newPoint = {
        time: new Date().toLocaleTimeString(),
        requests: metrics.total_requests || 0,
        blocked: metrics.blocked_requests || 0,
        mqtt: metrics.mqtt_total || 0,
      };
      return [...prev.slice(-30), newPoint];
    });
  }, [metrics]);

  const chartHistory = chartData;

  const typeBar = useMemo(() => {
    const c = {};
    (events || []).forEach(e => { c[e.type] = (c[e.type] || 0) + 1; });
    return [
      { name: 'Rate Limit',  value: (c.rate_limit  || 0) + (c.mqtt_flood || 0),  color: '#ff4d6a' },
      { name: 'Anomaly',     value: (c.anomaly     || 0) + (c.mqtt_anomaly || 0), color: '#f5c842' },
      { name: 'Blocked',     value: (c.ip_blocked  || 0) + (c.mqtt_blocked || 0), color: '#ff8c42' },
      { name: 'Auth Fail',   value: (c.mqtt_auth_fail || 0) + (c.mqtt_brute_force || 0), color: '#fa7faa' },
    ];
  }, [events]);

  const recentEvents = useMemo(() => [...(events || [])].reverse().slice(0, 10), [events]);

  const blockRate = m.total_requests > 0
    ? ((m.blocked_requests / (m.total_requests + m.blocked_requests)) * 100).toFixed(1)
    : '0.0';

  const tlConfig = {
    HIGH:   { color: 'var(--red)',    label: 'CRITICAL', desc: 'Active flood or rate-limit breach detected. Immediate review required.' },
    MEDIUM: { color: 'var(--yellow)', label: 'ELEVATED', desc: 'Anomalous traffic pattern detected. Monitor closely.' },
    LOW:    { color: 'var(--lime)',   label: 'NOMINAL',  desc: 'All systems operating within normal parameters.' },
  }[tl] || { color: 'var(--text-muted)', label: 'UNKNOWN', desc: 'No data.' };

  /* ── HTTP Simulation ─────────────────────────────────────────────── */
  async function getToken(deviceId, apiKey) {
    const r = await fetch(`${api}/auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, api_key: apiKey }),
    });
    return (await r.json()).token;
  }

  async function sendNormal() {
    setHttpStatus('Sending…');
    try {
      const tok = await getToken('device_1', 'key123');
      await fetch(`${api}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'X-Forwarded-For': '192.168.1.10' },
        body: JSON.stringify({ temperature: 25 }),
      });
      setHttpStatus('✓ Normal request sent');
    } catch { setHttpStatus('✗ Backend unreachable'); }
    setTimeout(() => setHttpStatus(''), 3000);
  }

  async function sendFlood() {
    setHttpStatus('Stage 1/3 — anomaly burst…');
    try {
      const tok = await getToken('device_1', 'key123');
      const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'X-Forwarded-For': '10.0.0.55' };
      const body = JSON.stringify({ temperature: 25 });
      const fire = () => fetch(`${api}/data`, { method: 'POST', headers: hdrs, body }).catch(() => {});
      await Promise.all(Array.from({ length: 10 }, fire));
      setHttpStatus('Stage 2/3 — rate limit…');
      await new Promise(r => setTimeout(r, 250));
      await Promise.all(Array.from({ length: 15 }, fire));
      setHttpStatus('Stage 3/3 — IP blocked…');
      await new Promise(r => setTimeout(r, 250));
      await Promise.all(Array.from({ length: 5 }, fire));
      setHttpStatus('✓ HTTP flood → anomaly → rate limit → block');
    } catch { setHttpStatus('✗ Backend unreachable'); }
    setTimeout(() => setHttpStatus(''), 4000);
  }

  async function sendAnomaly() {
    setHttpStatus('Sending suspicious burst…');
    try {
      const tok = await getToken('device_2', 'key456');
      const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'X-Forwarded-For': '10.0.0.77' };
      const body = JSON.stringify({ temperature: 25 });
      for (let i = 0; i < 9; i++) {
        fetch(`${api}/data`, { method: 'POST', headers: hdrs, body }).catch(() => {});
        await new Promise(r => setTimeout(r, 80));
      }
      setHttpStatus('✓ HTTP anomaly triggered — MEDIUM threat');
    } catch { setHttpStatus('✗ Backend unreachable'); }
    setTimeout(() => setHttpStatus(''), 3000);
  }

  /* ── MQTT Simulation ─────────────────────────────────────────────── */
  const mqttHeaders = (key, clientId, ip) => ({
    'Content-Type': 'application/json',
    'X-MQTT-Key': key,
    'X-MQTT-ClientId': clientId,
    'X-Forwarded-For': ip,
  });

  async function mqttNormal() {
    setMqttStatus('Publishing…');
    try {
      const r = await fetch(`${api}/mqtt/publish`, {
        method: 'POST',
        headers: mqttHeaders('key123', 'device_1', '192.168.10.10'),
        body: JSON.stringify({ topic: 'sensors/device_1/temp', payload: { temperature: 24 }, qos: 1 }),
      });
      const d = await r.json();
      setMqttStatus(d.status === 'published' ? '✓ MQTT publish accepted' : `✗ ${d.error}`);
    } catch { setMqttStatus('✗ Backend unreachable'); }
    setTimeout(() => setMqttStatus(''), 3000);
  }

  async function mqttFlood() {
    setMqttStatus('Stage 1/3 — MQTT burst…');
    try {
      const hdrs = mqttHeaders('key456', 'device_2', '10.1.0.55');
      const body = JSON.stringify({ topic: 'sensors/device_2/flood', payload: 'x'.repeat(50), qos: 0 });
      const fire = () => fetch(`${api}/mqtt/publish`, { method: 'POST', headers: hdrs, body }).catch(() => {});
      await Promise.all(Array.from({ length: 8 }, fire));
      setMqttStatus('Stage 2/3 — MQTT rate limit…');
      await new Promise(r => setTimeout(r, 200));
      await Promise.all(Array.from({ length: 12 }, fire));
      setMqttStatus('Stage 3/3 — MQTT client blocked…');
      await new Promise(r => setTimeout(r, 200));
      await Promise.all(Array.from({ length: 4 }, fire));
      setMqttStatus('✓ MQTT flood → burst → rate limit → block');
    } catch { setMqttStatus('✗ Backend unreachable'); }
    setTimeout(() => setMqttStatus(''), 4000);
  }

  async function mqttAuthFail() {
    setMqttStatus('Attempting bad credentials…');
    try {
      // Brute force: multiple bad CONNECT attempts
      const ip = '10.1.0.99';
      for (let i = 0; i < 10; i++) {
        await fetch(`${api}/mqtt/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
          body: JSON.stringify({ client_id: 'attacker_1', username: 'admin', password: `wrong_${i}` }),
        });
        await new Promise(r => setTimeout(r, 60));
      }
      setMqttStatus('✓ MQTT brute force triggered — HIGH threat');
    } catch { setMqttStatus('✗ Backend unreachable'); }
    setTimeout(() => setMqttStatus(''), 4000);
  }

  async function mqttOversize() {
    setMqttStatus('Sending oversized payload…');
    try {
      const r = await fetch(`${api}/mqtt/publish`, {
        method: 'POST',
        headers: mqttHeaders('key789', 'device_3', '10.1.0.33'),
        body: JSON.stringify({ topic: 'sensors/device_3/data', payload: 'A'.repeat(2048), qos: 2 }),
      });
      const d = await r.json();
      setMqttStatus(d.error ? `✓ Oversize blocked: ${d.error}` : '✓ Oversized payload sent');
    } catch { setMqttStatus('✗ Backend unreachable'); }
    setTimeout(() => setMqttStatus(''), 3500);
  }

  async function resetSystem() {
    setHttpStatus('Resetting…');
    try {
      await fetch(`${api}/reset`, { method: 'POST' });
      setHttpStatus('✓ System reset');
      if (onRefresh) onRefresh();
    } catch { setHttpStatus('✗ Backend unreachable'); }
    setTimeout(() => setHttpStatus(''), 3000);
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div className="label" style={{ color: 'var(--lime)', marginBottom: 6 }}>Security Operations Center</div>
          <h1 style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 30,
            color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 8,
          }}>
            Security Overview
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 400, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Real-time intrusion detection · HTTP + MQTT protocol monitoring.
          </p>
        </div>

        {/* Threat level hero */}
        <div style={{
          padding: '20px 24px', minWidth: 260,
          background: 'var(--bg-card)',
          border: `1px solid ${tlConfig.color}`,
          borderLeft: `4px solid ${tlConfig.color}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: `rgba(22,15,36,0.6) 0px 8px 24px, ${tlConfig.color}22 0px 0px 32px`,
          flexShrink: 0,
        }}>
          <div className="label" style={{ marginBottom: 6 }}>Threat Level</div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 27,
            color: tlConfig.color, letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 8,
          }}>
            {tlConfig.label}
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {tlConfig.desc}
          </p>
        </div>
      </div>

      {/* ── HTTP Stat cards ──────────────────────────────────────────────── */}
      <div>
        <div className="label" style={{ color: 'var(--cyan)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px', background: 'rgba(106,95,193,0.15)', border: '1px solid rgba(106,95,193,0.3)',
            borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9b8fbc',
          }}>HTTP</span>
          Protocol Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <StatCard className="card-1" label="Total Requests" value={m.total_requests ?? 0} sub="all sessions" color="#38bdf8"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          />
          <StatCard className="card-2" label="Blocked" value={m.blocked_requests ?? 0} sub={`${blockRate}% of traffic`} color="#ff4d6a"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
          />
          <StatCard className="card-3" label="Anomalies" value={m.anomalies ?? 0} sub="burst detections" color="#f5c842"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          />
          <StatCard className="card-4" label="Attacks" value={m.attack_attempts ?? 0} sub="flood attempts" color="#ff8c42"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
          />
          <StatCard className="card-5" label="Devices" value={m.unique_ips ?? 0} sub="unique IPs" color="#c2ef4e"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
          />
        </div>
      </div>

      {/* ── MQTT Stat cards ──────────────────────────────────────────────── */}
      <div>
        <div className="label" style={{ color: 'var(--cyan)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#38bdf8',
          }}>MQTT</span>
          Protocol Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <StatCard className="card-1" label="MQTT Publishes" value={m.mqtt_total ?? 0} sub="total messages" color="#38bdf8"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 2.18 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L6.91 9.91a16 16 0 0 0 6.08 6.08l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>}
          />
          <StatCard className="card-2" label="MQTT Blocked" value={m.mqtt_blocked ?? 0} sub="auth+flood blocks" color="#ff4d6a"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
          />
          <StatCard className="card-3" label="MQTT Anomalies" value={m.mqtt_anomalies ?? 0} sub="burst detections" color="#f5c842"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>}
          />
          <StatCard className="card-4" label="MQTT Clients" value={m.mqtt_unique_ips ?? 0} sub="unique client IPs" color="#c2ef4e"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 13"/><path d="M5 3a2 2 0 0 1 2 2v1a10.9 10.9 0 0 0 5.26 9.27"/></svg>}
          />
        </div>
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

        {/* Traffic area chart */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>Traffic Monitor</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)' }}>
                Request Volume
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {[{ c: '#38bdf8', l: 'HTTP' }, { c: '#c2ef4e', l: 'MQTT' }, { c: '#ff4d6a', l: 'Blocked' }].map(({ c, l }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 3, background: c, borderRadius: 2 }} />
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartHistory} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradMqtt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#c2ef4e" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#c2ef4e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradBlk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ff4d6a" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ff4d6a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(106,95,193,0.1)" />
              <XAxis dataKey="t" hide />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-ui)' }} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="requests" name="HTTP"    stroke="#38bdf8" strokeWidth={2}   fill="url(#gradReq)"  dot={false} />
              <Area type="monotone" dataKey="mqtt"     name="MQTT"    stroke="#c2ef4e" strokeWidth={1.5} fill="url(#gradMqtt)" dot={false} />
              <Area type="monotone" dataKey="blocked"  name="Blocked" stroke="#ff4d6a" strokeWidth={1.5} fill="url(#gradBlk)"  dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Event breakdown bars */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>Event Breakdown</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)', marginBottom: 20 }}>
            By Type
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={typeBar} margin={{ top: 0, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(106,95,193,0.1)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-dim)', fontSize: 8, fontFamily: 'var(--font-ui)', fontWeight: 600 }} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-ui)' }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" name="Events" radius={[4, 4, 0, 0]}>
                {typeBar.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {typeBar.map(({ name, value, color }) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{name}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Simulation consoles ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* HTTP Console */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="label" style={{ color: 'var(--lime)' }}>Simulation Console</div>
            <span style={{
              padding: '1px 7px', background: 'rgba(106,95,193,0.15)', border: '1px solid rgba(106,95,193,0.3)',
              borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9b8fbc', fontWeight: 700,
            }}>HTTP</span>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 18, color: 'var(--text-primary)', marginBottom: 6 }}>
            HTTP Attack Simulation
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.5 }}>
            Trigger HTTP-layer security events to test detection thresholds.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ActionBtn onClick={sendNormal} color="purple">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              TX — Send Normal Request
            </ActionBtn>
            <ActionBtn onClick={sendFlood} color="red">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              !! — Simulate HTTP Flood
            </ActionBtn>
            <ActionBtn onClick={sendAnomaly} color="yellow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
              ~~ — Suspicious Burst
            </ActionBtn>
          </div>

          {httpStatus && (
            <div style={{
              marginTop: 12, padding: '8px 12px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: httpStatus.startsWith('✓') ? 'var(--lime)' : httpStatus.startsWith('✗') ? 'var(--red)' : 'var(--text-muted)',
            }}>
              {httpStatus}
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <ActionBtn onClick={resetSystem} color="ghost">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.65"/></svg>
              RST — Reset All Counters
            </ActionBtn>
          </div>
        </div>

        {/* MQTT Console */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 'var(--radius-md)', padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="label" style={{ color: 'var(--lime)' }}>Simulation Console</div>
            <span style={{
              padding: '1px 7px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#38bdf8', fontWeight: 700,
            }}>MQTT</span>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 18, color: 'var(--text-primary)', marginBottom: 6 }}>
            MQTT Attack Simulation
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-dim)', marginBottom: 18, lineHeight: 1.5 }}>
            Trigger MQTT broker-layer security events — flood, auth, oversize.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ActionBtn onClick={mqttNormal} color="cyan">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/><path d="M5 3a2 2 0 0 1 2 2"/></svg>
              PUB — Normal MQTT Publish
            </ActionBtn>
            <ActionBtn onClick={mqttFlood} color="red">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              !! — MQTT Publish Flood
            </ActionBtn>
            <ActionBtn onClick={mqttAuthFail} color="pink">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              🔑 — Brute Force CONNECT
            </ActionBtn>
            <ActionBtn onClick={mqttOversize} color="yellow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              ~~ — Oversized Payload
            </ActionBtn>
          </div>

          {mqttStatus && (
            <div style={{
              marginTop: 12, padding: '8px 12px',
              background: 'var(--bg-elevated)', border: '1px solid rgba(56,189,248,0.2)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: mqttStatus.startsWith('✓') ? '#38bdf8' : mqttStatus.startsWith('✗') ? 'var(--red)' : 'var(--text-muted)',
            }}>
              {mqttStatus}
            </div>
          )}
        </div>
      </div>

      {/* ── Security event feed ──────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '24px',
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>Live Feed</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)' }}>
              Security Events
            </div>
          </div>
          <div style={{
            padding: '4px 10px',
            background: 'rgba(194,239,78,0.1)', border: '1px solid rgba(194,239,78,0.25)',
            borderRadius: 'var(--radius-xl)',
            fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
            color: 'var(--lime)', letterSpacing: '0.2px', textTransform: 'uppercase',
          }}>
            {events.length} Events · 30s window
          </div>
        </div>

        {recentEvents.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 160, gap: 12, color: 'var(--text-dim)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500 }}>No alerts — system nominal</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13 }}>Trigger a simulation to see events here.</div>
          </div>
        ) : (
          <div style={{ overflow: 'hidden', borderRadius: 'var(--radius)' }}>
            {/* Header: Type+Proto merged into one 200px column to prevent overlap */}
            <div style={{
              display: 'grid', gridTemplateColumns: '200px 150px 1fr 100px 70px',
              padding: '8px 14px',
              background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600,
              color: 'var(--text-dim)', letterSpacing: '0.25px', textTransform: 'uppercase',
            }}>
              <span>Type · Protocol</span>
              <span>IP Address</span>
              <span>Device</span>
              <span>Severity</span>
              <span style={{ textAlign: 'right' }}>Time</span>
            </div>

            {recentEvents.map((ev, i) => {
              const cfg = getEventConfig(ev.type);
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '200px 150px 1fr 100px 70px',
                  padding: '10px 14px', alignItems: 'center',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(106,95,193,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
                >
                  {/* Type + Proto badges side by side, no overlap */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <EventBadge type={ev.type} />
                    <ProtocolBadge protocol={ev.protocol || cfg.protocol} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0, boxShadow: `0 0 6px ${cfg.color}88` }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{ev.ip || '—'}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)' }}>{ev.device || '—'}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '2px 8px',
                    background: `${cfg.severityColor}14`,
                    border: `1px solid ${cfg.severityColor}33`,
                    borderRadius: 6,
                    fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
                    color: cfg.severityColor, letterSpacing: '0.2px', textTransform: 'uppercase',
                    width: 'fit-content',
                  }}>
                    {cfg.severity}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>{ev.time || '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
