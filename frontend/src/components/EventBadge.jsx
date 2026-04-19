export const EVENT_CONFIG = {
  // HTTP events
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
  // MQTT events
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
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 6,
      fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
      color: colors.color, letterSpacing: '0.2px', textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.color, display: 'inline-block', flexShrink: 0 }} />
      {severity}
    </span>
  );
}
