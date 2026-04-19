export default function StatCard({ label, value, sub, color, icon, className }) {
  return (
    <div className={className} style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderTop: `2px solid ${color || 'var(--purple)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '20px 24px',
      position: 'relative', overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
      transition: 'box-shadow 0.2s, transform 0.2s',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow-elevated)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Background glow blob */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 100, height: 100, borderRadius: '50%',
        background: `${color || 'var(--purple)'}`,
        opacity: 0.06, filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="label">{label}</span>
        {icon && (
          <span style={{ color: color || 'var(--purple)', opacity: 0.7, flexShrink: 0 }}>
            {icon}
          </span>
        )}
      </div>

      <div style={{
        fontFamily: 'var(--font-ui)', fontWeight: 700,
        fontSize: 42, lineHeight: 1,
        color: color || 'var(--text-primary)',
        letterSpacing: '-0.02em',
        marginBottom: 8,
      }}>
        {value ?? '—'}
      </div>

      {sub && (
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 400,
          color: 'var(--text-dim)', lineHeight: 1.4,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}
