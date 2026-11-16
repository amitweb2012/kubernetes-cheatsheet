"use client";

import { useCallback, useEffect, useState } from "react";

export default function HomePage() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadNotes = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/v1/notes", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load notes. Check that the API is running.");
      const result = await response.json();
      setNotes(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  async function createNote(event) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/v1/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Could not save note.");
      }
      setTitle("");
      setContent("");
      await loadNotes();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <div className="brand"><span className="brand-mark">P</span><span>Platform Notes</span></div>
        <span className="status"><i /> Kubernetes learning project</span>
      </header>

      <section className="intro">
        <p className="eyebrow">NEXT.JS + KUBERNETES</p>
        <h1>Your ideas,<br /><em>all in one place.</em></h1>
        <p className="subtext">A tiny notes app powered by Next.js, Express, Redis and PostgreSQL.</p>
      </section>

      <section className="workspace">
        <form className="composer" onSubmit={createNote}>
          <div className="section-heading"><span>CREATE A NOTE</span><span className="step">01 / WRITE</span></div>
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Give your note a title..." required />
          <label htmlFor="content">Your thoughts</label>
          <textarea id="content" value={content} onChange={e => setContent(e.target.value)} maxLength={10000} rows={5} placeholder="Start writing something worth remembering..." />
          <button disabled={saving || !title.trim()}>{saving ? "Saving..." : "Save note"} <span>↗</span></button>
        </form>

        <section className="notes">
          <div className="section-heading"><span>YOUR NOTES</span><span className="count">{notes.length} TOTAL</span></div>
          {error && <p className="error" role="alert">{error}</p>}
          {loading ? <p className="empty">Loading your notes...</p> :
            notes.length === 0 ? <p className="empty">Nothing here yet. Create your first note.</p> :
            <div className="note-list">{notes.map(note => (
              <article className="note" key={note.id}>
                <div className="note-top"><h2>{note.title}</h2><span>#{note.id}</span></div>
                <p>{note.content || "No additional details."}</p>
                <time>{new Date(note.created_at).toLocaleString()}</time>
              </article>
            ))}</div>}
        </section>
      </section>
      <footer>Built to learn how a frontend talks to a Kubernetes-hosted API.</footer>
    </main>
  );
}
