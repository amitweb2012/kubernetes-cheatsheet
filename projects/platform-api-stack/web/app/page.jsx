"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const categories = ["Kubernetes", "Helm", "Ingress", "Observability", "Security", "Database", "General"];
const iconFor = (category) => ({ Kubernetes:"⬡", Helm:"☸", Ingress:"⌘", Observability:"◉", Security:"◇", Database:"▤", General:"✦" }[category] || "✦");
function categoryFor(note) {
  if (categories.includes(note.category)) return note.category;
  const text = `${note.title} ${note.content}`.toLowerCase();
  if (/helm|chart/.test(text)) return "Helm";
  if (/ingress|routing|gateway/.test(text)) return "Ingress";
  if (/prometheus|grafana|monitor/.test(text)) return "Observability";
  if (/oauth|security|jwt|auth/.test(text)) return "Security";
  if (/postgres|database|sql|redis|migration/.test(text)) return "Database";
  if (/kubernetes|pod|deployment|service/.test(text)) return "Kubernetes";
  return "General";
}
const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" }) : "—";

export default function HomePage() {
  const { data: session, status: authStatus } = useSession();
  const [notes, setNotes] = useState([]);
  const [database, setDatabase] = useState(null);
  const [health, setHealth] = useState("checking");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [pinned, setPinned] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("Kubernetes");

  const loadDashboard = useCallback(async () => {
    setError("");
    try {
      const [notesResponse, dbResponse] = await Promise.all([
        fetch("/api/v1/notes", { cache:"no-store" }),
        fetch("/api/v1/ops/database", { cache:"no-store" })
      ]);
      if (notesResponse.status === 401 || dbResponse.status === 401) return;
      if (!notesResponse.ok) throw new Error("Could not load notes. Check API connectivity.");
      const noteData = await notesResponse.json();
      setNotes(noteData.data || []);
      if (dbResponse.ok) setDatabase(await dbResponse.json());
      setHealth(dbResponse.ok ? "online" : "degraded");
    } catch (e) {
      setError(e.message || "Dashboard request failed.");
      setHealth("offline");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authStatus === "authenticated") loadDashboard(); else if (authStatus === "unauthenticated") setLoading(false); }, [authStatus, loadDashboard]);

  async function createNote(event) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/v1/notes", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ title:title.trim(), content:content.trim(), category:noteCategory }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save note.");
      setTitle(""); setContent("");
      await loadDashboard();
    } catch(e) { setError(e.message); } finally { setSaving(false); }
  }

  const visibleNotes = useMemo(() => notes.filter(note => {
    const matchesSearch = `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (category === "All" || categoryFor(note) === category);
  }), [notes, search, category]);
  const lastUpdated = notes.length ? dateLabel(notes[0].created_at) : "—";

  if (authStatus === "loading") return <main className="auth-loading">Loading secure workspace…</main>;
  if (authStatus !== "authenticated") return (
    <main className="login-screen">
      <div className="login-card">
        <div className="login-mark">☸</div>
        <span className="eyebrow">PLATFORM NOTES · SECURE WORKSPACE</span>
        <h1>Your Kubernetes<br/><em>knowledge hub.</em></h1>
        <p>Sign in with your organization account to access notes, database health and migration history.</p>
        <button className="login-button" onClick={() => signIn("keycloak", { callbackUrl:"/" })}>Continue with OAuth 2.0 <span>↗</span></button>
        <small>OpenID Connect · Authorization Code flow · PKCE</small>
      </div>
    </main>
  );

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-kube">☸</span><strong>Kubernetes Notes</strong><span className="tech-pill">Next.js + Kubernetes</span></div>
        <div className="topbar-right">
          <span className={`health-pill ${health}`}><i/> API: {health === "online" ? "Online" : health === "checking" ? "Checking" : "Degraded"}</span>
          <span className={`health-pill ${database?.connected ? "online" : "degraded"}`}><i/> DB: {database?.connected ? "Connected" : "Unavailable"}</span>
          <button className="profile" onClick={() => signOut({ callbackUrl:"/" })}><span className="avatar">{(session.user?.name || session.user?.email || "U").slice(0,1).toUpperCase()}</span><span>{session.user?.name || session.user?.email || "User"}</span><b>⌄</b></button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className="sidebar">
          <nav><a className="nav-item active" href="#dashboard">⌂ <span>Dashboard</span></a><a className="nav-item" href="#notes">▤ <span>Notes</span></a><a className="nav-item" href="#create">＋ <span>Create Note</span></a><a className="nav-item" href="#database">⬡ <span>Database Info</span></a><a className="nav-item" href="#migrations">⌘ <span>Migrations</span></a></nav>
          <div className="sidebar-art"><div className="big-kube">☸</div><div className="stack-card"><b>◉　Next.js (Frontend)</b><b>⬢　Node.js (API)</b><b>▰　Redis (Cache)</b><b>◉　PostgreSQL (DB)</b><b>☸　Kubernetes (K8s)</b></div></div>
          <div className="sidebar-foot">PLATFORM API STACK<br/>LEARNING ENVIRONMENT</div>
        </aside>

        <section className="main-content" id="dashboard">
          <div className="welcome"><div><h1>Welcome to Kubernetes Notes 👋</h1><p>A Next.js workspace running on Kubernetes with Express API, Redis and PostgreSQL.</p></div><span className="env-label">DEMO ENVIRONMENT</span></div>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <div className="stat-grid">
            <article className="stat-card blue"><span className="stat-icon">▤</span><div><strong>{database?.noteCount ?? notes.length}</strong><small>Total Notes</small></div></article>
            <article className="stat-card green"><span className="stat-icon">✓</span><div><strong>{database?.noteCount ?? notes.length}</strong><small>Active Notes</small></div></article>
            <article className="stat-card purple"><span className="stat-icon">★</span><div><strong>{pinned.length}</strong><small>Pinned Notes</small></div></article>
            <article className="stat-card amber"><span className="stat-icon">▦</span><div><strong>{lastUpdated}</strong><small>Last Updated</small></div></article>
          </div>

          <div className="workspace-grid">
            <section className="notes-panel" id="notes">
              <div className="notes-heading"><h2>▤　Your Notes</h2><label className="search-box">⌕ <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes…"/></label></div>
              <div className="filter-row"><button className={category==="All"?"filter active-filter":"filter"} onClick={()=>setCategory("All")}>All</button>{categories.map(c=><button key={c} className={category===c?"filter active-filter":"filter"} onClick={()=>setCategory(c)}>{c}</button>)}</div>
              {loading ? <p className="empty-state">Loading your notes…</p> : visibleNotes.length === 0 ? <p className="empty-state">No notes found. Create your first note on the right.</p> :
                <div className="note-grid">{visibleNotes.map(note=>{const c=categoryFor(note);const isPinned=pinned.includes(note.id);return <article className={`note-card cat-${c.toLowerCase()}`} key={note.id}><div className="note-card-top"><span className={`category-tag tag-${c.toLowerCase()}`}>{c}</span><span className="note-logo">{iconFor(c)}</span></div><h3>{note.title}</h3><p>{note.content || "No additional details."}</p><div className="note-meta"><time>▦　{dateLabel(note.created_at)}</time><button aria-label={isPinned?"Unpin note":"Pin note"} className={isPinned?"pin pinned":"pin"} onClick={()=>setPinned(old=>isPinned?old.filter(id=>id!==note.id):[...old,note.id])}>{isPinned?"★":"☆"}</button></div></article>})}</div>}
            </section>

            <aside className="right-column">
              <form className="create-card" id="create" onSubmit={createNote}>
                <h2>✎　Create New Note</h2>
                <div className="form-body"><label htmlFor="note-title">Title <b>*</b></label><input id="note-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="Enter note title" required/>
                  <label htmlFor="note-category">Category</label><select id="note-category" value={noteCategory} onChange={e=>setNoteCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select>
                  <label htmlFor="note-content">Content <b>*</b></label><textarea id="note-content" value={content} onChange={e=>setContent(e.target.value)} maxLength={10000} rows={7} placeholder="Write your note here…" required/>
                  <div className="form-actions"><button className="save-button" disabled={saving||!title.trim()}>{saving?"Saving…":"▣　Save Note"}</button><button type="button" className="clear-button" onClick={()=>{setTitle("");setContent("");}}>↻　Clear</button></div>
                </div>
              </form>

              <section className="database-card" id="database"><h2>▤　Database Details</h2><div className="db-row"><span>Engine</span><strong>{database?.engine || "PostgreSQL"}</strong></div><div className="db-row"><span>Database</span><strong>{database?.database || "—"}</strong></div><div className="db-row"><span>Connection</span><strong className={database?.connected?"good":"bad"}>{database?.connected?"Connected":"Unavailable"}</strong></div><div className="db-row"><span>Notes table rows</span><strong>{database?.noteCount ?? "—"}</strong></div><div className="db-row"><span>Redis cache</span><strong>{database?.redis || "—"}</strong></div></section>

              <section className="database-card migration-card" id="migrations"><h2>⟳　Migration History</h2>{database?.migrations?.length ? database.migrations.map(m=><div className="migration-row" key={m.version}><span className="migration-check">✓</span><div><strong>{m.version}</strong><small>{dateLabel(m.applied_at)}</small></div></div>) : <p className="empty-small">Migration history is not available yet.</p>}<small className="migration-foot">Versioned SQL · Transactional execution</small></section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
