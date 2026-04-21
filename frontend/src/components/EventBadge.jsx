// ── Event type config (unchanged) ────────────────────────────────────────────
export const EVENT_CONFIG = {
  rate_limit: {
    label: 'Rate Limit', color: '#ff4d6a', bg: 'rgba(255,77,106,0.14)',
    border: 'rgba(255,77,106,0.35)', severity: 'HIGH', severityColor: '#ff4d6a',
    protocol: 'http',
  },
  anomaly: {
    label: 'Anomaly', color: '#f5c842', bg: 'rgba(245,200,66,0.12)',
    border: 'rgba(245,200,66,0.3)', severity: 'MEDIUM', severityColor: '#f5c842',
    protocol: 'http',
  },
  ip_blocked: {
    label: 'IP Blocked', color: '#ff8c42', bg: 'rgba(255,140,66,0.14)',
    border: 'rgba(255,140,66,0.3)', severity: 'HIGH', severityColor: '#ff4d6a',
    protocol: 'http',
  },
  behavior_drift: {
    label: 'Drift', color: '#ff9f43', bg: 'rgba(255,159,67,0.14)',
    border: 'rgba(255,159,67,0.3)', severity: 'MEDIUM', severityColor: '#ff9f43',
    protocol: 'http',
  },
  mqtt_flood: {
    label: 'MQTT Flood', color: '#ff4d6a', bg: 'rgba(255,77,106,0.14)',
    border: 'rgba(255,77,106,0.35)', severity: 'HIGH', severityColor: '#ff4d6a',
    protocol: 'mqtt',
  },
  mqtt_anomaly: {
    label: 'MQTT Burst', color: '#f5c842', bg: 'rgba(245,200,66,0.12)',
    border: 'rgba(245,200,66,0.3)', severity: 'MEDIUM', severityColor: '#f5c842',
    protocol: 'mqtt',
  },
  mqtt_blocked: {
    label: 'MQTT Blocked', color: '#ff8c42', bg: 'rgba(255,140,66,0.14)',
    border: 'rgba(255,140,66,0.3)', severity: 'HIGH', severityColor: '#ff4d6a',
    protocol: 'mqtt',
  },
  mqtt_auth_fail: {
    label: 'MQTT Auth Fail', color: '#fa7faa', bg: 'rgba(250,127,170,0.12)',
    border: 'rgba(250,127,170,0.3)', severity: 'HIGH', severityColor: '#ff4d6a',
    protocol: 'mqtt',
  },
  mqtt_brute_force: {
    label: 'MQTT Brute Force', color: '#ff4d6a', bg: 'rgba(255,77,106,0.14)',
    border: 'rgba(255,77,106,0.35)', severity: 'HIGH', severityColor: '#ff4d6a',
    protocol: 'mqtt',
  },
  mqtt_oversized: {
    label: 'MQTT Oversize', color: '#ff8c42', bg: 'rgba(255,140,66,0.14)',
    border: 'rgba(255,140,66,0.3)', severity: 'MEDIUM', severityColor: '#f5c842',
    protocol: 'mqtt',
  },
};

export function getEventConfig(type) {
  return EVENT_CONFIG[type] || {
    label: type?.replace(/_/g, ' ').toUpperCase() || 'Unknown',
    color: '#9b8fbc', bg: 'rgba(155,143,188,0.1)',
    border: 'rgba(155,143,188,0.25)', severity: 'LOW', severityColor: '#3ecf8e',
    protocol: 'http',
  };
}

// ── Device type config ────────────────────────────────────────────────────────
export const DEVICE_TYPE_CONFIG = {
  cctv: {
    label: 'CCTV',       icon: '📷', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)',
    description: 'CCTV Camera',
  },
  hvac: {
    label: 'HVAC',       icon: '🌡', color: '#f5c842', bg: 'rgba(245,200,66,0.12)',  border: 'rgba(245,200,66,0.3)',
    description: 'HVAC Unit',
  },
  smart_lock: {
    label: 'Smart Lock', icon: '🔐', color: '#fa7faa', bg: 'rgba(250,127,170,0.12)', border: 'rgba(250,127,170,0.3)',
    description: 'Smart Lock',
  },
  sensor: {
    label: 'Sensor',     icon: '📡', color: '#3ecf8e', bg: 'rgba(62,207,142,0.12)',  border: 'rgba(62,207,142,0.3)',
    description: 'IoT Sensor',
  },
  gateway: {
    label: 'Gateway',    icon: '🔀', color: '#c2ef4e', bg: 'rgba(194,239,78,0.12)',  border: 'rgba(194,239,78,0.3)',
    description: 'Network Gateway',
  },
  unknown: {
    label: 'Device',     icon: '📟', color: '#9b8fbc', bg: 'rgba(155,143,188,0.1)',  border: 'rgba(155,143,188,0.25)',
    description: 'Unknown Device',
  },
};

export function getDeviceTypeConfig(device_type) {
  return DEVICE_TYPE_CONFIG[device_type] || DEVICE_TYPE_CONFIG.unknown;
}

// ── Attack story generator ────────────────────────────────────────────────────
// Converts raw event + device_type into a human-readable explanation
const ATTACK_STORIES = {
  rate_limit: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    const stories = {
      cctv:    `${dt.icon} CCTV camera at ${ev.ip} triggered a frame burst storm — ${ev.device} sent too many motion events in a 5-second window, saturating the API gateway.`,
      hvac:    `${dt.icon} HVAC unit at ${ev.ip} flooded the API with rapid telemetry — likely a sensor malfunction causing runaway reporting.`,
      gateway: `${dt.icon} Gateway at ${ev.ip} exceeded the rate limit — possible diagnostic loop or misconfigured polling interval.`,
      sensor:  `${dt.icon} Sensor at ${ev.ip} surpassed the request threshold — possible firmware bug causing continuous retransmission.`,
    };
    return stories[ev.device_type] || `Device at ${ev.ip} exceeded the rate limit of 20 requests / 5 seconds. IP blocked for 30 seconds.`;
  },

  anomaly: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    return `${dt.icon} ${dt.description} at ${ev.ip} showed a sudden traffic burst — request rate exceeded ${ev.device_type === 'cctv' ? '8 frames/sec, consistent with a motion event storm' : '8 req/sec, indicating abnormal behavior'}.`;
  },

  behavior_drift: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    const stories = {
      hvac:    `${dt.icon} HVAC unit at ${ev.ip} deviated significantly from its baseline — sudden spike in reporting rate may indicate sensor failure or tampered firmware.`,
      cctv:    `${dt.icon} CCTV camera at ${ev.ip} drifted from its normal frame rate baseline — possible hardware issue or replay attack.`,
      gateway: `${dt.icon} Gateway at ${ev.ip} deviated from its normal heartbeat pattern — possible configuration change or upstream attack.`,
    };
    return stories[ev.device_type] || `Device at ${ev.ip} deviated from its established traffic baseline. Current rate is more than 2× normal.`;
  },

  ip_blocked: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    return `${dt.icon} ${dt.description} at ${ev.ip} is currently blocked — repeated policy violations triggered automatic IP block. Remaining: ${ev.remaining || '?'}s.`;
  },

  mqtt_flood: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    return `${dt.icon} ${dt.description} at ${ev.ip} (${ev.device}) published more than 15 messages in 5 seconds — MQTT publish flood detected. Client blocked for 30 seconds.`;
  },

  mqtt_anomaly: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    return `${dt.icon} ${dt.description} at ${ev.ip} showed an MQTT burst — ${ev.device} published more than 6 messages in 1 second, exceeding the anomaly threshold.`;
  },

  mqtt_brute_force: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    return `${dt.icon} ${dt.description} at ${ev.ip} attempted repeated MQTT CONNECT with incorrect credentials — brute force attack detected. More than 8 failed connect attempts in 10 seconds.`;
  },

  mqtt_auth_fail: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    return `${dt.icon} ${dt.description} at ${ev.ip} (${ev.device}) failed MQTT authentication — invalid API key presented. Possible credential theft or misconfiguration.`;
  },

  mqtt_blocked: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    return `${dt.icon} ${dt.description} at ${ev.ip} is MQTT-blocked — client ${ev.device} was previously flagged and is now denied broker access.`;
  },

  mqtt_oversized: (ev) => {
    const dt = getDeviceTypeConfig(ev.device_type);
    return `${dt.icon} ${dt.description} at ${ev.ip} sent an oversized MQTT payload${ev.size ? ` (${ev.size} bytes, limit is 1024)` : ''} — possible diagnostic dump injection or buffer overflow attempt.`;
  },
};

export function generateAttackStory(ev) {
  if (!ev || !ev.type) return 'Unknown security event.';
  const fn = ATTACK_STORIES[ev.type];
  if (fn) return fn(ev);
  return `Security event: ${ev.type} from ${ev.ip || 'unknown'} (${ev.device || 'unknown device'}).`;
}

// ── Badge components ──────────────────────────────────────────────────────────

export function ProtocolBadge({ protocol }) {
  const isMqtt = protocol === 'mqtt';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 6px',
      background: isMqtt ? 'rgba(56,189,248,0.12)' : 'rgba(106,95,193,0.12)',
      border: `1px solid ${isMqtt ? 'rgba(56,189,248,0.3)' : 'rgba(106,95,193,0.3)'}`,
      borderRadius: 4,
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
      color: isMqtt ? '#38bdf8' : '#9b8fbc',
      letterSpacing: '0.3px', textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      {isMqtt ? 'MQTT' : 'HTTP'}
    </span>
  );
}

// NEW: DeviceTypeBadge — shows device type with icon
export function DeviceTypeBadge({ device_type }) {
  const cfg = getDeviceTypeConfig(device_type || 'unknown');
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 4,
      fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600,
      color: cfg.color,
      letterSpacing: '0.15px', textTransform: 'uppercase',
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 10 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// NEW: BehaviorIndicator — Normal / Anomalous pill
export function BehaviorIndicator({ isAnomalous }) {
  const color  = isAnomalous ? '#ff4d6a' : '#3ecf8e';
  const bg     = isAnomalous ? 'rgba(255,77,106,0.10)' : 'rgba(62,207,142,0.10)';
  const border = isAnomalous ? 'rgba(255,77,106,0.3)' : 'rgba(62,207,142,0.25)';
  const label  = isAnomalous ? 'Anomalous' : 'Normal';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px',
      background: bg, border: `1px solid ${border}`,
      borderRadius: 'var(--radius-xl)',
      fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
      color, letterSpacing: '0.2px',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: color,
        display: 'inline-block', flexShrink: 0,
        boxShadow: isAnomalous ? `0 0 6px ${color}` : 'none',
      }} />
      {label}
    </span>
  );
}

export default function EventBadge({ type }) {
  const cfg = getEventConfig(type);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 6,
      fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
      color: cfg.color, letterSpacing: '0.2px', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const colors = {
    HIGH:   { color: '#ff4d6a', bg: 'rgba(255,77,106,0.12)',  border: 'rgba(255,77,106,0.3)'  },
    MEDIUM: { color: '#f5c842', bg: 'rgba(245,200,66,0.10)',  border: 'rgba(245,200,66,0.25)' },
    LOW:    { color: '#3ecf8e', bg: 'rgba(62,207,142,0.10)',  border: 'rgba(62,207,142,0.25)' },
  }[severity] || { color: '#9b8fbc', bg: 'rgba(155,143,188,0.1)', border: 'rgba(155,143,188,0.25)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px',
      background: colors.bg, border: `1px solid ${colors.border}`,
      borderRadius: 6,
      fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
      color: colors.color, letterSpacing: '0.2px', textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.color, display: 'inline-block', flexShrink: 0 }} />
      {severity}
    </span>
  );
}
