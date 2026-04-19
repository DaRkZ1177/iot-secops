import { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) { setError('Enter username and password'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      // Store token in sessionStorage
      sessionStorage.setItem('iot_token', data.token);
      sessionStorage.setItem('iot_user',  JSON.stringify({ username: data.username, role: data.role }));
      onLogin(data.token, { username: data.username, role: data.role });
    } catch {
      setError('Cannot reach backend — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'linear-gradient(rgba(106,95,193,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(106,95,193,0.04) 1px, transparent 1px)',
        backgroundSize: '32px 32px', pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px', position: 'relative' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--purple-deep) 0%, var(--purple) 100%)',
            border: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: 'rgba(106,95,193,0.4) 0px 8px 32px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 24,
            color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 6,
          }}>
            IoT SecOps
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--lime)', letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>
            Security Operations Center
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '32px',
          boxShadow: 'rgba(22,15,36,0.6) 0px 24px 64px',
        }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 10,
            color: 'var(--text-dim)', letterSpacing: '0.25px', textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            Sign in to continue
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Username */}
            <div>
              <label style={{
                display: 'block', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
                color: 'var(--text-muted)', letterSpacing: '0.2px', textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                Username
              </label>
              <input
                type="text" value={username} autoFocus
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                onBlur={e  => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 600,
                color: 'var(--text-muted)', letterSpacing: '0.2px', textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                Password
              </label>
              <input
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                onBlur={e  => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.3)',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            {/* Submit — DESIGN.md muted purple button with inset shadow */}
            <button
              type="submit" disabled={loading}
              style={{
                marginTop: 4, padding: '12px',
                background: loading ? 'rgba(121,98,140,0.5)' : 'var(--purple-muted)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-inset)',
                color: '#ffffff',
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
                letterSpacing: '0.2px', textTransform: 'uppercase',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = 'var(--shadow-elevated)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-inset)'; }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Default credentials hint */}
        <div style={{
          marginTop: 16, textAlign: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)',
        }}>
          Default: <span style={{ color: 'var(--text-muted)' }}>admin</span> / <span style={{ color: 'var(--text-muted)' }}>admin123</span>
        </div>
      </div>
    </div>
  );
}
