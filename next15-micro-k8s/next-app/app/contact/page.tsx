"use client";

import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("Sending...");

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message })
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setStatus("Message sent successfully ✅");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      console.error(err);
      setStatus("Error sending message ❌");
    }
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Contact</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: "1rem" }}>
          <label>Name</label>
          <br />
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label>Message</label>
          <br />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit">Send</button>
      </form>
      {status && <p style={{ marginTop: "1rem" }}>{status}</p>}
    </main>
  );
}
