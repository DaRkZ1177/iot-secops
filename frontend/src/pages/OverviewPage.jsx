import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import StatCard from '../components/StatCard.jsx';
import EventBadge, {
  getEventConfig, ProtocolBadge, DeviceTypeBadge,
  BehaviorIndicator, generateAttackStory, getDeviceTypeConfig,
} from '../components/EventBadge.jsx';

// ── Device profile metadata (mirrors backend) ─────────────────────────────
const DEVICE_PROFILES = [
  { device_id: 'cctv_entrance',     device_type: 'cctv',       ip: '192.168.1.10', protocol: 'http',  attack_label: 'Frame Burst',    api_key: 'key123', description: 'Entrance CCTV Camera' },
  { device_id: 'hvac_floor2',       device_type: 'hvac',       ip: '192.168.1.20', protocol: 'http',  attack_label: 'Sensor Drift',   api_key: 'key456', description: 'HVAC Unit Floor 2' },
  { device_id: 'smart_lock_server', device_type: 'smart_lock', ip: '192.168.1.30', protocol: 'mqtt',  attack_label: 'Brute Force',    api_key: 'key789', description: 'Server Room Smart Lock' },
  { device_id: 'sensor_warehouse',  device_type: 'sensor',     ip: '192.168.1.40', protocol: 'mqtt',  attack_label: 'Publish Flood',  api_key: 'key123', description: 'Warehouse Sensor' },
  { device_id: 'gateway_main',      device_type: 'gateway',    ip: '192.168.1.50', protocol: 'http',  attack_label: 'Oversized Payload', api_key: 'key456', description: 'Main Gateway' },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: 12, boxShadow: 'var(--shadow-elevated)' }}>
      {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>)}
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

function ActionBtn({ onClick, color = 'purple', children, disabled, small }) {
  const styles = {
    purple: { bg: 'var(--purple-muted)', border: 'var(--border-light)', color: '#fff' },
    red:    { bg: 'rgba(255,77,106,0.15)', border: 'rgba(255,77,106,0.4)', color: '#ff4d6a' },
    yellow: { bg: 'rgba(245,200,66,0.12)', border: 'rgba(245,200,66,0.35)', color: '#f5c842' },
    cyan:   { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)', color: '#38bdf8' },
    pink:   { bg: 'rgba(250,127,170,0.12)', border: 'rgba(250,127,170,0.35)', color: '#fa7faa' },
    green:  { bg: 'rgba(62,207,142,0.12)', border: 'rgba(62,207,142,0.35)', color: '#3ecf8e' },
    ghost:  { bg: 'rgba(255,255,255,0.04)', border: 'var(--border)', color: 'var(--text-muted)' },
    lime:   { bg: 'rgba(194,239,78,0.12)', border: 'rgba(194,239,78,0.35)', color: '#c2ef4e' },
  }[color];

  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: small ? 'auto' : '100%',
        padding: small ? '6px 12px' : '10px 16px',
        background: disabled ? 'rgba(255,255,255,0.03)' : styles.bg,
        border: `1px solid ${disabled ? 'var(--border)' : styles.border}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: (!disabled && color === 'purple') ? 'var(--shadow-inset)' : 'none',
        color: disabled ? 'var(--text-dim)' : styles.color,
        fontFamily: 'var(--font-ui)', fontSize: small ? 11 : 12, fontWeight: 700,
        letterSpacing: '0.2px', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'box-shadow 0.15s, background 0.15s',
        textAlign: 'left', opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.boxShadow = (color === 'purple') ? 'var(--shadow-inset)' : 'none'; }}
    >
      {children}
    </button>
  );
}

// ── Autonomous simulation engine (runs entirely in the browser) ───────────
class BrowserSimEngine {
  constructor(api) {
    this.api     = api;
    this.running = false;
    this.chaos   = 0.3;
    this.timers  = [];
    this._tokens = {};
  }

  async init() {
    for (const d of DEVICE_PROFILES) {
      if (d.protocol === 'http') {
        try {
          const r = await fetch(`${this.api}/auth`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: d.device_id, api_key: d.api_key }),
          });
          const j = await r.json();
          this._tokens[d.device_id] = j.token;
        } catch { /* backend may not be ready yet */ }
      } else {
        try {
          await fetch(`${this.api}/mqtt/connect`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': d.ip, 'X-Device-Type': d.device_type },
            body: JSON.stringify({ client_id: d.device_id, username: d.device_id, password: d.api_key }),
          });
        } catch { }
      }
    }
  }

  _httpHeaders(d, withAuth = true) {
    const h = { 'Content-Type': 'application/json', 'X-Forwarded-For': d.ip, 'X-Device-Type': d.device_type };
    if (withAuth && this._tokens[d.device_id]) h['Authorization'] = `Bearer ${this._tokens[d.device_id]}`;
    return h;
  }

  _mqttHeaders(d) {
    return { 'Content-Type': 'application/json', 'X-Forwarded-For': d.ip, 'X-MQTT-Key': d.api_key, 'X-MQTT-ClientId': d.device_id, 'X-Device-Type': d.device_type };
  }

  async _sendNormal(d) {
    try {
      if (d.protocol === 'http') {
        await fetch(`${this.api}/data`, { method: 'POST', headers: this._httpHeaders(d), body: JSON.stringify({ temperature: 20 + Math.random() * 10 }) });
      } else {
        await fetch(`${this.api}/mqtt/publish`, {
          method: 'POST', headers: this._mqttHeaders(d),
          body: JSON.stringify({ topic: `devices/${d.device_id}/telemetry`, payload: { value: Math.random() * 100 }, qos: 1 }),
        });
      }
    } catch { }
  }

  async triggerAttack(device_type) {
    const d = DEVICE_PROFILES.find(p => p.device_type === device_type);
    if (!d) return;
    await this._runAttack(d);
  }

  async _runAttack(d) {
    if (d.device_type === 'cctv' || d.device_type === 'hvac') {
      const count = d.device_type === 'cctv' ? 28 : 12;
      const body  = JSON.stringify({ temperature: d.device_type === 'hvac' ? 75 : 25, alert: 'attack' });
      for (let i = 0; i < count; i++) {
        fetch(`${this.api}/data`, { method: 'POST', headers: this._httpHeaders(d), body }).catch(() => {});
        await new Promise(r => setTimeout(r, 50));
      }
    } else if (d.device_type === 'smart_lock') {
      for (let i = 0; i < 12; i++) {
        fetch(`${this.api}/mqtt/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': d.ip, 'X-Device-Type': d.device_type },
          body: JSON.stringify({ client_id: d.device_id, username: d.device_id, password: `wrong_${Math.floor(Math.random() * 9999)}` }),
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 120));
      }
    } else if (d.device_type === 'sensor') {
      for (let i = 0; i < 25; i++) {
        fetch(`${this.api}/mqtt/publish`, {
          method: 'POST', headers: this._mqttHeaders(d),
          body: JSON.stringify({ topic: `devices/${d.device_id}/flood`, payload: { value: i }, qos: 0 }),
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 40));
      }
    } else if (d.device_type === 'gateway') {
      fetch(`${this.api}/mqtt/publish`, {
        method: 'POST', headers: this._mqttHeaders(d),
        body: JSON.stringify({ topic: `devices/${d.device_id}/diag`, payload: 'X'.repeat(2048), qos: 1 }),
      }).catch(() => {});
    }
  }

  _scheduleDevice(d) {
    const interval = d.protocol === 'http' ? (3000 + Math.random() * 3000) : (2000 + Math.random() * 4000);
    const timer = setTimeout(async () => {
      if (!this.running) return;
      const willAttack = Math.random() < this.chaos;
      if (willAttack) {
        await this._runAttack(d);
        // cooldown after attack
        const cooldown = setTimeout(() => { if (this.running) this._scheduleDevice(d); }, 12000 + Math.random() * 8000);
        this.timers.push(cooldown);
      } else {
        await this._sendNormal(d);
        this._scheduleDevice(d);
      }
    }, interval);
    this.timers.push(timer);
  }

  async start(chaos) {
    this.chaos   = chaos;
    this.running = true;
    await this.init();
    // Stagger device starts
    for (let i = 0; i < DEVICE_PROFILES.length; i++) {
      const d = DEVICE_PROFILES[i];
      const startDelay = setTimeout(() => { if (this.running) this._scheduleDevice(d); }, i * 800);
      this.timers.push(startDelay);
    }
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  setChaos(level) {
    this.chaos = level;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function OverviewPage({ metrics, events, api, onRefresh }) {
  const m  = metrics || {};
  const tl = m.threat_level || 'LOW';

  const [simMode,    setSimMode]    = useState('manual');   // 'manual' | 'autonomous'
  const [chaos,      setChaos]      = useState(0.3);
  const [simStatus,  setSimStatus]  = useState('');
  const [devStatus,  setDevStatus]  = useState({});         // per-device status messages
  const [chartData,  setChartData]  = useState([]);
  const engineRef = useRef(null);

  // Initialise engine once
  useEffect(() => {
    engineRef.current = new BrowserSimEngine(api);
    return () => engineRef.current?.stop();
  }, [api]);

  useEffect(() => {
    if (!metrics) return;
    setChartData(prev => {
      const pt = { time: new Date().toLocaleTimeString(), requests: metrics.total_requests || 0, blocked: metrics.blocked_requests || 0, mqtt: metrics.mqtt_total || 0 };
      return [...prev.slice(-30), pt];
    });
  }, [metrics]);

  // ── Simulation controls ──────────────────────────────────────────────────
  async function startAutonomous() {
    setSimStatus('Starting autonomous simulation…');
    await engineRef.current.start(chaos);
    setSimMode('autonomous');
    setSimStatus(`Autonomous — chaos ${Math.round(chaos * 100)}% — all devices active`);
  }

  function stopAutonomous() {
    engineRef.current?.stop();
    setSimMode('manual');
    setSimStatus('Autonomous simulation stopped');
    setTimeout(() => setSimStatus(''), 3000);
  }

  function handleChaosChange(val) {
    setChaos(val);
    engineRef.current?.setChaos(val);
    if (simMode === 'autonomous') setSimStatus(`Chaos updated → ${Math.round(val * 100)}%`);
  }

  async function triggerDeviceAttack(device_type, label) {
    setDevStatus(prev => ({ ...prev, [device_type]: `Triggering ${label}…` }));
    await engineRef.current?.triggerAttack(device_type);
    setDevStatus(prev => ({ ...prev, [device_type]: `✓ ${label} sent` }));
    setTimeout(() => setDevStatus(prev => ({ ...prev, [device_type]: '' })), 3000);
    onRefresh?.();
  }

  async function sendNormalAll() {
    setSimStatus('Sending normal traffic from all devices…');
    for (const d of DEVICE_PROFILES) await engineRef.current?._sendNormal(d);
    setSimStatus('✓ Normal traffic sent from all devices');
    setTimeout(() => setSimStatus(''), 3000);
    onRefresh?.();
  }

  async function resetSystem() {
    setSimStatus('Resetting…');
    try {
      await fetch(`${api}/reset`, { method: 'POST' });
      setSimStatus('✓ System reset');
      onRefresh?.();
    } catch { setSimStatus('✗ Backend unreachable'); }
    setTimeout(() => setSimStatus(''), 3000);
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const typeBar = useMemo(() => {
    const c = {};
    (events || []).forEach(e => { c[e.type] = (c[e.type] || 0) + 1; });
    return [
      { name: 'Rate Limit',  value: (c.rate_limit || 0) + (c.mqtt_flood || 0), color: '#ff4d6a' },
      { name: 'Anomaly',     value: (c.anomaly || 0) + (c.mqtt_anomaly || 0) + (c.behavior_drift || 0), color: '#f5c842' },
      { name: 'Blocked',     value: (c.ip_blocked || 0) + (c.mqtt_blocked || 0), color: '#ff8c42' },
      { name: 'Auth Fail',   value: (c.mqtt_auth_fail || 0) + (c.mqtt_brute_force || 0), color: '#fa7faa' },
    ];
  }, [events]);

  const recentEvents = useMemo(() => [...(events || [])].reverse().slice(0, 10), [events]);

  const blockRate = m.total_requests > 0
    ? ((m.blocked_requests / (m.total_requests + m.blocked_requests)) * 100).toFixed(1)
    : '0.0';

  const tlConfig = {
    HIGH:   { color: 'var(--red)',    label: 'CRITICAL', desc: 'Active flood or rate-limit breach detected.' },
    MEDIUM: { color: 'var(--yellow)', label: 'ELEVATED', desc: 'Anomalous traffic pattern detected.' },
    LOW:    { color: 'var(--lime)',   label: 'NOMINAL',  desc: 'All systems operating within normal parameters.' },
  }[tl] || { color: 'var(--text-muted)', label: 'UNKNOWN', desc: '' };

  const chaosLabel = chaos < 0.2 ? 'Low' : chaos < 0.5 ? 'Medium' : chaos < 0.75 ? 'High' : 'Extreme';
  const chaosColor = chaos < 0.2 ? '#3ecf8e' : chaos < 0.5 ? '#f5c842' : chaos < 0.75 ? '#ff8c42' : '#ff4d6a';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div className="label" style={{ color: 'var(--lime)', marginBottom: 6 }}>Security Operations Center</div>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 30, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 8 }}>
            Security Overview
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Real-time intrusion detection · HTTP + MQTT · 5 device profiles.
          </p>
        </div>
        <div style={{ padding: '20px 24px', minWidth: 260, background: 'var(--bg-card)', border: `1px solid ${tlConfig.color}`, borderLeft: `4px solid ${tlConfig.color}`, borderRadius: 'var(--radius-md)', boxShadow: `rgba(22,15,36,0.6) 0px 8px 24px`, flexShrink: 0 }}>
          <div className="label" style={{ marginBottom: 6 }}>Threat Level</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 27, color: tlConfig.color, letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 8 }}>{tlConfig.label}</div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tlConfig.desc}</p>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div>
        <div className="label" style={{ color: 'var(--cyan)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ padding: '2px 8px', background: 'rgba(106,95,193,0.15)', border: '1px solid rgba(106,95,193,0.3)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9b8fbc' }}>HTTP</span>
          Protocol Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <StatCard className="card-1" label="Total Requests" value={m.total_requests ?? 0} sub="all sessions" color="#38bdf8" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>} />
          <StatCard className="card-2" label="Blocked" value={m.blocked_requests ?? 0} sub={`${blockRate}% of traffic`} color="#ff4d6a" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} />
          <StatCard className="card-3" label="Anomalies" value={m.anomalies ?? 0} sub="burst + drift" color="#f5c842" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>} />
          <StatCard className="card-4" label="Attacks" value={m.attack_attempts ?? 0} sub="flood attempts" color="#ff8c42" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
          <StatCard className="card-5" label="Devices" value={m.unique_ips ?? 0} sub="unique IPs" color="#c2ef4e" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>} />
        </div>
      </div>

      <div>
        <div className="label" style={{ color: 'var(--cyan)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ padding: '2px 8px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#38bdf8' }}>MQTT</span>
          Protocol Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <StatCard className="card-1" label="MQTT Publishes" value={m.mqtt_total ?? 0} sub="total messages" color="#38bdf8" />
          <StatCard className="card-2" label="MQTT Blocked"   value={m.mqtt_blocked ?? 0} sub="auth+flood" color="#ff4d6a" />
          <StatCard className="card-3" label="MQTT Anomalies" value={m.mqtt_anomalies ?? 0} sub="burst detections" color="#f5c842" />
          <StatCard className="card-4" label="MQTT Clients"   value={m.mqtt_unique_ips ?? 0} sub="unique IPs" color="#c2ef4e" />
        </div>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>Traffic Monitor</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)' }}>Request Volume</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ c: '#38bdf8', l: 'HTTP' }, { c: '#c2ef4e', l: 'MQTT' }, { c: '#ff4d6a', l: 'Blocked' }].map(({ c, l }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 3, background: c, borderRadius: 2 }} />
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25}/><stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/></linearGradient>
                <linearGradient id="gMq"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c2ef4e" stopOpacity={0.2}/><stop offset="95%" stopColor="#c2ef4e" stopOpacity={0}/></linearGradient>
                <linearGradient id="gBlk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff4d6a" stopOpacity={0.2}/><stop offset="95%" stopColor="#ff4d6a" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(106,95,193,0.1)" />
              <XAxis dataKey="time" hide />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-ui)' }} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="requests" name="HTTP"    stroke="#38bdf8" strokeWidth={2}   fill="url(#gReq)"  dot={false} />
              <Area type="monotone" dataKey="mqtt"     name="MQTT"    stroke="#c2ef4e" strokeWidth={1.5} fill="url(#gMq)"   dot={false} />
              <Area type="monotone" dataKey="blocked"  name="Blocked" stroke="#ff4d6a" strokeWidth={1.5} fill="url(#gBlk)"  dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
          <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>Event Breakdown</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)', marginBottom: 20 }}>By Type</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={typeBar} margin={{ top: 0, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(106,95,193,0.1)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-dim)', fontSize: 8, fontFamily: 'var(--font-ui)', fontWeight: 600 }} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-ui)' }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" name="Events" radius={[4, 4, 0, 0]}>{typeBar.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {typeBar.map(({ name, value, color }) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{name}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Simulation Console ───────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>Simulation Console</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)' }}>Attack Simulation Engine</div>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['manual', 'autonomous'].map(mode => (
              <button key={mode} onClick={() => { if (mode === 'autonomous') startAutonomous(); else stopAutonomous(); }}
                style={{
                  padding: '8px 16px',
                  background: simMode === mode ? (mode === 'autonomous' ? 'rgba(194,239,78,0.15)' : 'var(--purple-muted)') : 'transparent',
                  border: `1px solid ${simMode === mode ? (mode === 'autonomous' ? 'rgba(194,239,78,0.4)' : 'var(--border-light)') : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700,
                  color: simMode === mode ? (mode === 'autonomous' ? '#c2ef4e' : '#fff') : 'var(--text-muted)',
                  letterSpacing: '0.2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {mode === 'autonomous' ? '⚡ Auto' : '🎮 Manual'}
              </button>
            ))}
          </div>
        </div>

        {/* Chaos slider */}
        <div style={{ marginBottom: 20, padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>Chaos Level</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-dim)' }}>
                Controls attack probability in autonomous mode
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 20, color: chaosColor }}>{Math.round(chaos * 100)}%</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: chaosColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15px' }}>{chaosLabel}</div>
            </div>
          </div>
          <input
            type="range" min="0" max="1" step="0.05" value={chaos}
            onChange={e => handleChaosChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: chaosColor }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {['0% — All normal', '25% — Low', '50% — Medium', '75% — High', '100% — Chaos'].map(l => (
              <span key={l} style={{ fontFamily: 'var(--font-ui)', fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1px' }}>{l.split(' — ')[1] || l}</span>
            ))}
          </div>
        </div>

        {/* Status message */}
        {simStatus && (
          <div style={{ marginBottom: 16, padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: 11, color: simStatus.startsWith('✓') ? 'var(--lime)' : simStatus.startsWith('✗') ? 'var(--red)' : 'var(--text-muted)' }}>
            {simStatus}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Manual controls */}
          <div>
            <div className="label" style={{ marginBottom: 10, color: '#9b8fbc' }}>Manual Override</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ActionBtn onClick={sendNormalAll} color="purple">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                TX — Send Normal (All Devices)
              </ActionBtn>
              <ActionBtn onClick={resetSystem} color="ghost">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.65"/></svg>
                RST — Reset All Counters
              </ActionBtn>
            </div>
          </div>

          {/* Per-device attack triggers */}
          <div>
            <div className="label" style={{ marginBottom: 10, color: '#38bdf8' }}>Device Attack Triggers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEVICE_PROFILES.map(d => {
                const dtc = getDeviceTypeConfig(d.device_type);
                return (
                  <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => triggerDeviceAttack(d.device_type, d.attack_label)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px',
                        background: 'transparent',
                        border: `1px solid ${dtc.border}`,
                        borderRadius: 'var(--radius)',
                        color: dtc.color, fontFamily: 'var(--font-ui)', fontSize: 11,
                        fontWeight: 600, letterSpacing: '0.15px', textTransform: 'uppercase',
                        cursor: 'pointer', transition: 'all 0.14s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = dtc.bg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 12 }}>{dtc.icon}</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{d.description}</span>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>→ {d.attack_label}</span>
                    </button>
                    {devStatus[d.device_type] && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: devStatus[d.device_type].startsWith('✓') ? 'var(--lime)' : 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 90 }}>
                        {devStatus[d.device_type]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Security event feed ──────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div className="label" style={{ color: 'var(--lime)', marginBottom: 4 }}>Live Feed</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--text-primary)' }}>Security Events</div>
          </div>
          <div style={{ padding: '4px 10px', background: 'rgba(194,239,78,0.1)', border: '1px solid rgba(194,239,78,0.25)', borderRadius: 'var(--radius-xl)', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600, color: 'var(--lime)', letterSpacing: '0.2px', textTransform: 'uppercase' }}>
            {events.length} Events · 30s window
          </div>
        </div>

        {recentEvents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 12, color: 'var(--text-dim)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500 }}>No alerts — system nominal</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13 }}>Use the simulation console or start autonomous mode.</div>
          </div>
        ) : (
          <div style={{ overflow: 'hidden', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 100px 100px 130px 1fr 70px', padding: '8px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.25px', textTransform: 'uppercase' }}>
              <span>Type</span><span>Protocol</span><span>Device Type</span><span>IP / Device</span><span>Story</span><span style={{ textAlign: 'right' }}>Time</span>
            </div>
            {recentEvents.map((ev, i) => {
              const cfg  = getEventConfig(ev.type);
              const ts   = ev.timestamp ? new Date(ev.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
              const story = generateAttackStory(ev);
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 100px 100px 130px 1fr 70px', padding: '10px 14px', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(106,95,193,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
                >
                  <EventBadge type={ev.type} />
                  <ProtocolBadge protocol={ev.protocol || cfg.protocol} />
                  <DeviceTypeBadge device_type={ev.device_type} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{ev.ip || '—'}</span>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-dim)' }}>{ev.device || '—'}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, paddingRight: 8 }}>{story}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>{ts}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
