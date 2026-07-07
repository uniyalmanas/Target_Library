"use client";

import { useState } from "react";
import Link from "next/link";

export default function MembersSearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/members?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setSearched(true);
  }

  return (
    <div className="space-y-6">
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
          Member Directory
        </h1>
        <p className="text-xs text-text-muted mt-1">Search permanent member profiles and access full payment and subscription history.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 max-w-lg bg-panel-bg border border-panel-border p-3 rounded-xl backdrop-blur-xs">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or Member ID (e.g. 1287)"
          className="flex-1 bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-text-muted outline-none transition-all duration-200"
        />
        <button className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-all duration-200 shadow-md shadow-rose-600/10 cursor-pointer hover:-translate-y-0.5">
          Search
        </button>
      </form>

      {searched && results.length === 0 && (
        <p className="text-text-muted text-sm py-4 bg-panel-bg/40 border border-panel-border border-dashed rounded-xl text-center">No matching members found.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((m) => (
          <Link
            key={m.student_id}
            href={`/members/${m.student_id}`}
            className="group flex justify-between items-center bg-card-bg border border-card-border hover:border-rose-500/40 rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-black/5 cursor-pointer"
          >
            <div>
              <p className="font-semibold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">{m.name}</p>
              <p className="text-xs text-text-muted mt-1">
                Student ID: <span className="font-mono text-text-details">#{m.student_id}</span>
                {m.phone && <span className="text-text-muted"> &middot; {m.phone}</span>}
              </p>
            </div>
            <span className="text-text-muted group-hover:text-rose-600 dark:group-hover:text-rose-400 text-xs font-semibold tracking-wider transition-colors uppercase">
              View Profile &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
