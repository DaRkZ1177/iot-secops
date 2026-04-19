import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar      from './components/Sidebar.jsx';
import Topbar       from './components/Topbar.jsx';
import LoginPage    from './pages/LoginPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import AlertsPage   from './pages/AlertsPage.jsx';
import DevicesPage  from './pages/DevicesPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';

const API          = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const POLL_MS      = 4000;
const HISTORY_WINDOW = 5 * 60 * 1000;

function loadSession() {
  try {
    const token = sessionStorage.getItem('iot_token');
    const user  = sessionStorage.getItem('iot_user');
    if (token && user) return { token, user: JSON.parse(user) };
  } catch {}
  return null;
}

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const saved = loadSession();
  const [token, setToken] = useState(saved?.token || null);
  const [user,  setUser]  = useState(saved?.user  || null);

  function handleLogin(tok, usr) {
    setToken(tok); setUser(usr);
    sessionStorage.setItem('iot_token', tok);
    sessionStorage.setItem('iot_user',  JSON.stringify(usr));
  }
  function handleLogout() {
    setToken(null); setUser(null);
    sessionStorage.removeItem('iot_token');
    sessionStorage.removeItem('iot_user');
  }

  // ── Routing ───────────────────────────────────────────────────────────────
  const [page, setPage] = useState('overview');

  // ── Live data ─────────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState(null);
  const [events,  setEvents]  = useState([]);
  const [error,   setError]   = useState(false);
  const [lastAt,  setLastAt]  = useState(null);

  // ── 5-min persistent history ──────────────────────────────────────────────
  const [eventHistory, setEventHistory] = useState([]);
  const seenEventKeys = useRef(new Map());

  // ── Alert badge ───────────────────────────────────────────────────────────
  const [alertsSeenAt, setAlertsSeenAt] = useState(0);

  const mergeIntoHistory = useCallback((newEvents) => {
    if (!Array.isArray(newEvents) || newEvents.length === 0) return;
    const now    = Date.now();
    const cutoff = now - HISTORY_WINDOW;

    setEventHistory(prev => {
      const pruned = prev.filter(e => e._clientTs > cutoff);

      for (const [k, ts] of seenEventKeys.current.entries()) {
        if (ts < cutoff) seenEventKeys.current.delete(k);
      }

      const toAdd = [];
      for (const ev of newEvents) {
        let key;
        if (ev.type === 'ip_blocked' || ev.type === 'mqtt_blocked') {
          key = `${Math.floor(ev.timestamp / 30)}-${ev.type}-${ev.ip}`;
        } else {
          key = `${Math.floor(ev.timestamp / 5)}-${ev.type}-${ev.ip}-${ev.device || ''}`;
        }
        if (!seenEventKeys.current.has(key)) {
          seenEventKeys.current.set(key, now);
          toAdd.push({ ...ev, _clientTs: now });
        }
      }

      if (toAdd.length === 0) return pruned;
      return [...pruned, ...toAdd];
    });
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [mRes, eRes] = await Promise.all([
        fetch(`${API}/metrics`),
        fetch(`${API}/events`),
      ]);
      if (!mRes.ok || !eRes.ok) throw new Error();
      const m = await mRes.json();
      const e = await eRes.json();
      const evts = Array.isArray(e.events) ? e.events : [];
      setMetrics(m);
      setEvents(evts);
      mergeIntoHistory(evts);
      setError(false);
      setLastAt(new Date());
    } catch {
      setError(true);
    }
  }, [mergeIntoHistory]);

  useEffect(() => {
    if (!token) return;
    fetchAll();
    const id = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(id);
  }, [fetchAll, token]);

  const handleAlertsView = useCallback(() => {
    setAlertsSeenAt(metrics?.blocked_requests ?? 0);
  }, [metrics]);

  useEffect(() => {
    if (page === 'alerts') setAlertsSeenAt(metrics?.blocked_requests ?? 0);
  }, [page, metrics]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!token) return <LoginPage onLogin={handleLogin} />;

  function renderPage() {
    switch (page) {
      case 'overview':  return <OverviewPage  metrics={metrics} events={events} api={API} onRefresh={fetchAll} />;
      case 'alerts':    return <AlertsPage    events={eventHistory} metrics={metrics} />;
      case 'devices':   return <DevicesPage   events={eventHistory} metrics={metrics} />;
      case 'analytics': return <AnalyticsPage metrics={metrics} />;
      default:          return <OverviewPage  metrics={metrics} events={events} api={API} onRefresh={fetchAll} />;
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar
        page={page} setPage={setPage}
        metrics={metrics}
        alertsSeen={alertsSeenAt}
        onAlertsView={handleAlertsView}
        user={user}
        onLogout={handleLogout}
      />
      <div style={{
        marginLeft: 'var(--sidebar-w)', flex: 1,
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg)', minHeight: '100vh',
      }}>
        <Topbar metrics={metrics} error={error} lastAt={lastAt} onRefresh={fetchAll} page={page} />
        <main className="bg-grid" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          <div className="page-enter" key={page}>
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}
