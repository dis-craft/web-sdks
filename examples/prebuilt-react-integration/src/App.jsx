import { HMSPrebuilt, Diagnostics } from '@100mslive/roomkit-react';
import { getRoomCodeFromUrl } from './utils';

const ADMIN_KEY = 'prod_admin_authenticated';

function isAdmin() {
  return sessionStorage.getItem(ADMIN_KEY) === 'true';
}

function setAdmin(value) {
  if (value) sessionStorage.setItem(ADMIN_KEY, 'true');
  else sessionStorage.removeItem(ADMIN_KEY);
}

function AdminPage() {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loggedIn, setLoggedIn] = React.useState(isAdmin());
  const [roomCode, setRoomCode] = React.useState('');
  const [className, setClassName] = React.useState('Abhishree Fashion Academy');
  const [generated, setGenerated] = React.useState('');

  const login = event => {
    event.preventDefault();
    if (username === 'admin' && password === 'admin123') {
      setAdmin(true);
      setLoggedIn(true);
      setMessage('Admin mode enabled for this demo.');
    } else {
      setMessage('Invalid demo credentials.');
    }
  };

  if (!loggedIn) {
    return (
      <div className="prod-shell auth-shell">
        <div className="brand-mark">ABHISHREE</div>
        <div className="glass-card auth-card">
          <p className="eyebrow">FASHION ACADEMY</p>
          <h1>Admin access</h1>
          <p className="muted">Create and launch live classes.</p>
          <form onSubmit={login} className="stack">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
            <button className="luxury-button" type="submit">Sign in</button>
          </form>
          {message && <p className="status-text">{message}</p>}
          <p className="demo-note">Demo credentials: admin / admin123</p>
        </div>
      </div>
    );
  }

  const createClass = event => {
    event.preventDefault();
    const code = roomCode.trim();
    if (!code) {
      setMessage('Enter a 100ms room code from the dashboard.');
      return;
    }
    const url = `${window.location.origin}/meeting/${encodeURIComponent(code)}`;
    setGenerated(url);
    localStorage.setItem('prod_last_class', JSON.stringify({ className, code, url }));
    setMessage('Class link ready.');
  };

  return (
    <div className="prod-shell">
      <header className="prod-nav">
        <div>
          <div className="brand-mark">ABHISHREE</div>
          <div className="brand-sub">FASHION ACADEMY</div>
        </div>
        <button className="text-button" onClick={() => { setAdmin(false); setLoggedIn(false); }}>Log out</button>
      </header>

      <main className="admin-grid">
        <section className="hero-copy">
          <p className="eyebrow">LIVE CLASSROOM</p>
          <h1>Teach in a room designed around the craft.</h1>
          <p className="hero-lead">Use the 100ms conference experience underneath a refined Abhishree fashion-education interface.</p>
        </section>

        <section className="glass-card">
          <p className="eyebrow">ADMIN CONSOLE</p>
          <h2>Start a class</h2>
          <form onSubmit={createClass} className="stack">
            <label>Class name<input value={className} onChange={e => setClassName(e.target.value)} /></label>
            <label>100ms room code<input value={roomCode} onChange={e => setRoomCode(e.target.value)} placeholder="abc-defg-hij" /></label>
            <button className="luxury-button" type="submit">Create class link</button>
          </form>
          {message && <p className="status-text">{message}</p>}
          {generated && (
            <div className="link-card">
              <div className="muted small">Student/teacher link</div>
              <a href={generated}>{generated}</a>
              <div className="link-actions">
                <button className="secondary-button" onClick={() => navigator.clipboard?.writeText(generated)}>Copy link</button>
                <a className="luxury-button inline-button" href={generated}>Open class</a>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LandingPage() {
  const [roomCode, setRoomCode] = React.useState('');
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
              <a className="luxury-button inline-button" href="#join">Join a class</a>
              <a className="secondary-button" href="https://abhishredesigners.com" target="_blank" rel="noreferrer">Visit Abhishree Designers</a>
            </div>
          </div>
          <div className="hero-panel">
            <div className="fashion-card card-one"></div>
            <div className="fashion-card card-two"></div>
            <div className="gold-line"></div>
          </div>
        </section>

        <section id="join" className="join-section">
          <div>
            <p className="eyebrow">JOIN LIVE</p>
            <h2>Have a class code?</h2>
            <p className="muted">Enter the 100ms room code provided by your instructor.</p>
          </div>
          <form className="join-form" onSubmit={event => { event.preventDefault(); if (roomCode.trim()) window.location.href = `/meeting/${roomCode.trim()}`; }}>
            <input value={roomCode} onChange={e => setRoomCode(e.target.value)} placeholder="abc-defg-hij" />
            <button className="luxury-button" type="submit">Join class</button>
          </form>
        </section>

        <section id="classes" className="feature-section">
          <div><span>01</span><h3>Live demonstrations</h3><p>Watch and interact with instructors in real time.</p></div>
          <div><span>02</span><h3>Focused learning</h3><p>Keep students in one dedicated classroom space.</p></div>
          <div><span>03</span><h3>Abhishree aesthetic</h3><p>Carry the visual identity of the fashion house into the digital experience.</p></div>
        </section>

        <section id="about" className="about-section">
          <p className="eyebrow">THE BRAND</p>
          <h2>Craft, detail and individuality.</h2>
          <p className="muted">The production frontend is styled around the dark, editorial, gold-accented language of the Abhishree Designers site while the underlying conferencing experience remains powered by 100ms.</p>
        </section>
      </main>
    </div>
  );
}

function ReactImport() {}

export default function App() {
  const pathname = window.location.pathname;
  const roomCode = getRoomCodeFromUrl();

  if (pathname.startsWith('/diagnostics')) return <Diagnostics />;
  if (pathname === '/admin' || pathname === '/admin/') return <AdminPage />;
  if (!roomCode) return <LandingPage />;

  return <HMSPrebuilt roomCode={roomCode} />;
}
