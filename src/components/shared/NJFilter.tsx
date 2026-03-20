"use client";

import { useState, useRef, useEffect } from "react";
import type { NJ } from "@/lib/types";

interface NJFilterProps {
  value: number | "all";
  onChange: (value: number | "all") => void;
}

export function NJFilter({ value, onChange }: NJFilterProps) {
  const [njs, setNjs] = useState<NJ[] | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/nj")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNjs(data); });
  }, []);

  const selectedName =
    value === "all"
      ? "All NJs"
      : (njs?.find((n: NJ) => n.id === value)?.name ?? "…");

  const filtered =
    njs?.filter((n: NJ) =>
      n.name.toLowerCase().includes(search.toLowerCase())
    ) ?? [];

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function select(val: number | "all") {
    onChange(val);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 flex items-center gap-2 min-w-[160px] hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        <span className="flex-1 text-left truncate">{selectedName}</span>
        <svg
          className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-60 overflow-hidden">
          <div className="p-1.5 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search CSM…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {!search && (
              <button
                type="button"
                onClick={() => select("all")}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors ${
                  value === "all" ? "text-indigo-600 font-semibold bg-indigo-50/60" : "text-gray-700"
                }`}
              >
                All NJs
              </button>
            )}
            {filtered.map((nj: NJ) => (
              <button
                key={nj.id}
                type="button"
                onClick={() => select(nj.id)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors ${
                  value === nj.id ? "text-indigo-600 font-semibold bg-indigo-50/60" : "text-gray-700"
                }`}
              >
                {nj.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
