import React from 'react';
import { HMSPrebuilt, Diagnostics } from '@100mslive/roomkit-react';
import { getRoomCodeFromUrl } from './utils';

function defaultClassTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function AdminLogin({ onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const login = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invalid admin credentials.');
      onLogin();
    } catch (error) {
      setMessage(error.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="prod-shell auth-shell">
      <div className="brand-mark">ABHISHREE</div>
      <div className="glass-card auth-card">
        <p className="eyebrow">FASHION ACADEMY</p>
        <h1>Admin access</h1>
        <p className="muted">Create scheduled Google Meet classes and notify students.</p>
        <form onSubmit={login} className="stack">
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" autoComplete="username" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" autoComplete="current-password" />
          <button className="luxury-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        {message && <p className="status-text">{message}</p>}
      </div>
    </div>
  );
}

function AdminPage() {
  const [authState, setAuthState] = React.useState('checking');
  const [google, setGoogle] = React.useState({ connected: false, email: null });
  const [className, setClassName] = React.useState('Abhishree Fashion Academy');
  const [description, setDescription] = React.useState('');
  const [startsAt, setStartsAt] = React.useState(defaultClassTime);
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [autoRecord, setAutoRecord] = React.useState(true);
  const [numbersText, setNumbersText] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const refreshGoogle = React.useCallback(async () => {
    try {
      const response = await fetch('/api/google/status');
      if (response.status === 401) {
        setAuthState('loggedOut');
        return;
      }
      const data = await response.json();
      setGoogle(data);
    } catch {
      setGoogle({ connected: false, email: null });
    }
  }, []);

  React.useEffect(() => {
    fetch('/api/admin/status')
      .then(response => response.json())
      .then(data => setAuthState(data.authenticated ? 'loggedIn' : 'loggedOut'))
      .catch(() => setAuthState('loggedOut'));
  }, []);

  React.useEffect(() => {
    if (authState === 'loggedIn') refreshGoogle();
  }, [authState, refreshGoogle]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'connected') {
      setMessage('Google account connected.');
      window.history.replaceState({}, '', '/admin');
      refreshGoogle();
    } else if (params.get('google') === 'error') {
      setMessage(params.get('message') || 'Google connection failed.');
      window.history.replaceState({}, '', '/admin');
    }
  }, [refreshGoogle]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthState('loggedOut');
  };

  const createClass = async event => {
    event.preventDefault();
    setCreating(true);
    setMessage('');
    setResult(null);

    const whatsappNumbers = numbersText
      .split(/[\n,]+/)
      .map(value => value.trim())
      .filter(Boolean);

    try {
      const response = await fetch('/api/meet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className,
          description,
          startsAt,
          durationMinutes: Number(durationMinutes),
          autoRecord,
          whatsappNumbers,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create class.');
      setResult(data);
      setMessage(data.notifications?.some(item => item.status === 'failed')
        ? 'Class created, but one or more WhatsApp messages failed.'
        : 'Class created successfully.');
    } catch (error) {
      setMessage(error.message || 'Could not create class.');
    } finally {
      setCreating(false);
    }
  };

  if (authState === 'checking') {
    return <div className="prod-shell centered-state"><p className="muted">Checking admin session…</p></div>;
  }

  if (authState === 'loggedOut') return <AdminLogin onLogin={() => setAuthState('loggedIn')} />;

  return (
    <div className="prod-shell">
      <header className="prod-nav">
        <div>
          <div className="brand-mark">ABHISHREE</div>
          <div className="brand-sub">DESIGNERS · FASHION ACADEMY</div>
        </div>
        <button className="text-button" onClick={logout}>Log out</button>
      </header>

      <main className="admin-grid">
        <section className="hero-copy">
          <p className="eyebrow">LIVE CLASSROOM</p>
          <h1>One place to schedule, start and share every class.</h1>
          <p className="hero-lead">Create the Google Meet from your academy dashboard, then send students your branded academy link instead of exposing the Google Meet URL.</p>
          <div className={`connection-pill ${google.connected ? 'connected' : ''}`}>
            <span className="connection-dot"></span>
            {google.connected ? `Google connected${google.email ? ` · ${google.email}` : ''}` : 'Google account not connected'}
          </div>
        </section>

        <section className="glass-card">
          <p className="eyebrow">ADMIN CONSOLE</p>
          <h2>Create a class</h2>

          {!google.connected && (
            <div className="setup-callout">
              <strong>Connect Google first.</strong>
              <span>Authorize the academy Google account used to host the Meet and store calendar/recording artifacts.</span>
              <a className="secondary-button" href="/api/google/auth">Connect Google</a>
            </div>
          )}

          <form onSubmit={createClass} className="stack">
            <label>Class name<input value={className} onChange={e => setClassName(e.target.value)} placeholder="Class name" /></label>
            <label>Start date & time<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
            <label>Duration (minutes)<input type="number" min="15" max="480" step="15" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} /></label>
            <label>Description (optional)<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What will this class cover?" rows="3" /></label>
            <label>WhatsApp numbers<textarea value={numbersText} onChange={e => setNumbersText(e.target.value)} placeholder="+919876543210&#10;+919876543211&#10;One number per line" rows="4" /></label>
            <label className="check-row"><input type="checkbox" checked={autoRecord} onChange={e => setAutoRecord(e.target.checked)} /><span>Enable automatic recording when an eligible host joins</span></label>
            <button className="luxury-button" type="submit" disabled={!google.connected || creating}>
              {creating ? 'Creating class…' : 'Create class & notify students'}
            </button>
          </form>

          {message && <p className="status-text">{message}</p>}

          {result && (
            <div className="link-card result-card">
              <div className="eyebrow">READY</div>
              <div className="muted small">Student link</div>
              <a href={result.joinUrl}>{result.joinUrl}</a>
              <div className="link-actions">
                <button className="secondary-button" type="button" onClick={() => navigator.clipboard?.writeText(result.joinUrl)}>Copy academy link</button>
                <a className="luxury-button inline-button" href={result.meetingUri} target="_blank" rel="noreferrer">Open Google Meet</a>
              </div>
              <div className="result-meta">
                <span>{result.startsAt ? new Date(result.startsAt).toLocaleString('en-IN') : 'Scheduled'}</span>
                <span>{result.durationMinutes} min</span>
                <span>{result.recordingEnabled ? 'Auto-recording on' : 'Recording on demand'}</span>
              </div>
              {result.notifications?.length > 0 && (
                <div className="notification-results">
                  {result.notifications.map((item, index) => (
                    <div key={item.id || item.to || index} className={`notification-row ${item.status}`}>
                      <span>{item.to || `${item.recipients} recipients`}</span>
                      <strong>{item.status.replaceAll('_', ' ')}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="prod-shell landing-shell">
      <header className="prod-nav">
        <div>
          <div className="brand-mark">ABHISHREE</div>
          <div className="brand-sub">DESIGNERS · FASHION ACADEMY</div>
        </div>
        <div className="nav-actions">
          <a href="#classes">Classes</a>
          <a href="#about">About</a>
          <a href="/admin">Admin</a>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">ABHISHREE DESIGNERS</p>
            <h1>Learn the art of fashion with a live classroom experience.</h1>
            <p className="hero-lead">A premium digital home for live fashion classes, demonstrations and guided learning.</p>
            <div className="hero-actions">
              <a className="luxury-button inline-button" href="/admin">Conduct a class</a>
              <a className="secondary-button" href="https://abhishredesigners.com" target="_blank" rel="noreferrer">Visit Abhishree Designers</a>
            </div>
          </div>
          <div className="hero-panel">
            <div className="fashion-card card-one"></div>
            <div className="fashion-card card-two"></div>
            <div className="gold-line"></div>
          </div>
        </section>

        <section id="classes" className="join-section">
          <div>
            <p className="eyebrow">JOIN LIVE</p>
            <h2>Have your academy class link?</h2>
            <p className="muted">Students receive a branded academy URL. That link securely redirects to the Google Meet created for the class.</p>
          </div>
          <a className="luxury-button inline-button" href="/admin">Admin portal</a>
        </section>

        <section className="feature-section">
          <div><span>01</span><h3>Live demonstrations</h3><p>Conduct interactive classes with Google Meet while your academy owns the entry point.</p></div>
          <div><span>02</span><h3>Scheduled sessions</h3><p>Create the class from the academy console and attach a Google Meet conference to the schedule.</p></div>
          <div><span>03</span><h3>Branded joining</h3><p>Students receive your academy link instead of a raw Google Meet URL.</p></div>
        </section>

        <section id="about" className="about-section">
          <p className="eyebrow">THE BRAND</p>
          <h2>Craft, detail and individuality.</h2>
          <p className="muted">The production frontend follows the dark, editorial, gold-accented Abhishree language while Google Meet handles the live conference and your academy controls how students reach it.</p>
        </section>
      </main>
    </div>
  );
}

function JoinRedirect({ token }) {
  const [state, setState] = React.useState({ status: 'loading', className: 'Live class' });

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/join?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'This class link is no longer available.');
        if (cancelled) return;
        setState({ status: 'redirecting', className: data.className || 'Live class' });
        window.setTimeout(() => {
          window.location.assign(data.meetingUri);
        }, 700);
      })
      .catch(error => {
        if (!cancelled) setState({ status: 'error', className: error.message || 'Invalid class link.' });
      });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="prod-shell centered-state">
      <div className="glass-card redirect-card">
        <p className="eyebrow">ABHISHREE LIVE</p>
        {state.status === 'error' ? (
          <>
            <h2>Class link unavailable</h2>
            <p className="muted">{state.className}</p>
            <a className="secondary-button" href="/">Back to academy</a>
          </>
        ) : (
          <>
            <h2>{state.status === 'redirecting' ? 'Entering your class…' : 'Preparing your class…'}</h2>
            <p className="muted">{state.className}</p>
            <div className="redirect-spinner"></div>
            <p className="demo-note">Opening the secure Google Meet session.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const pathname = window.location.pathname;
  const roomCode = getRoomCodeFromUrl();

  if (pathname.startsWith('/diagnostics')) return <Diagnostics />;
  if (pathname === '/admin' || pathname === '/admin/') return <AdminPage />;

  const joinMatch = pathname.match(/^\/join\/([^/]+)\/?$/);
  if (joinMatch) return <JoinRedirect token={decodeURIComponent(joinMatch[1])} />;

  // Keep legacy 100ms room links functional while the academy moves to Google Meet.
  if (roomCode) return <HMSPrebuilt roomCode={roomCode} />;

  return <LandingPage />;
}
