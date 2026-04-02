"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { Search, X, AlertTriangle, ChevronRight } from "lucide-react";
import { TrendLineChart } from "@/components/panels/qubits/TrendLineChart";

// ── types ──────────────────────────────────────────────────────────────────────

interface NJSummary {
  id:           number;
  name:         string;
  empId:        string | null;
  designation:  string | null;
  joinDate:     string;
  latestScore:  number | null;
  latestDate:   string | null;
}

interface QubitScore {
  id:                  number;
  njId:                number;
  date:                string;
  score:               number;
  category:            string | null;
  recordingsCompleted: number | null;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function scoreColour(score: number | null) {
  if (score === null) return { bg: "bg-gray-100", text: "text-gray-400", label: "No data" };
  if (score >= 70)   return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Good" };
  if (score >= 50)   return { bg: "bg-amber-100",   text: "text-amber-700",   label: "Average" };
  return               { bg: "bg-red-100",           text: "text-red-700",     label: "Below target" };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── component ──────────────────────────────────────────────────────────────────

export default function QubitsPage() {
  const [summary,     setSummary]     = useState<NJSummary[] | null>(null);
  const [scores,      setScores]      = useState<QubitScore[] | null>(null);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen,setDropdownOpen]= useState(false);

  useEffect(() => {
    fetch("/api/qubits?q=allSummary")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSummary(data); });
  }, []);

  useEffect(() => {
    if (selectedId === null) { setScores(null); return; }
    fetch(`/api/qubits?njId=${selectedId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setScores(data); });
  }, [selectedId]);

  if (!summary) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-28 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="animate-pulse h-96 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  // Derived counts
  const withData   = summary.filter(r => r.latestScore !== null);
  const completed  = withData.length;
  const pending    = summary.length - completed;
  const belowAlert = withData.filter(r => (r.latestScore ?? 0) < 50);

  const selectedNJ = selectedId ? summary.find(r => r.id === selectedId) : null;
  const trendData  = scores
    ? [...scores].sort((a, b) => a.date.localeCompare(b.date)).map(s => ({ date: s.date, score: s.score }))
    : [];
  const latestScore = scores && scores.length > 0
    ? scores.sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  const filtered = searchQuery.trim()
    ? summary.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  function select(id: number, name: string) {
    setSelectedId(id);
    setSearchQuery(name);
    setDropdownOpen(false);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Qubits</h1>
        <p className="text-sm text-gray-500 mt-0.5">Daily Qubits scores with threshold-based colour coding</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">CSMs with Scores</div>
          <div className="text-4xl font-black">{completed}</div>
          <div className="text-xs text-white/60 mt-1">Have at least one score</div>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Awaiting Scores</div>
          <div className="text-4xl font-black">{pending}</div>
          <div className="text-xs text-white/60 mt-1">No Qubits data yet</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Below Target (&lt;50)</div>
          <div className="text-4xl font-black">{belowAlert.length}</div>
          <div className="text-xs text-white/60 mt-1">Require attention</div>
        </div>
      </div>

      {/* Alert feed */}
      {belowAlert.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
              Below-target Alerts — {belowAlert.length} CSM{belowAlert.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {belowAlert.map(r => (
              <button
                key={r.id}
                onClick={() => select(r.id, r.name)}
                className="flex items-center gap-2 bg-white border border-red-200 rounded-xl px-3 py-1.5 text-xs shadow-sm hover:border-red-400 transition-colors"
              >
                <span className="font-semibold text-gray-800">{r.name}</span>
                <span className="font-bold text-red-600">{r.latestScore}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main grid: table + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: search + table */}
        <div className="lg:col-span-3 space-y-4">

          {/* Search */}
          <div className="relative">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-400 transition-all bg-white shadow-sm">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search CSM by name…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
              {(searchQuery || selectedId) && (
                <button onClick={() => { setSearchQuery(""); setSelectedId(null); }}>
                  <X size={14} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {dropdownOpen && filtered.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {filtered.slice(0, 8).map(r => {
                  const c = scoreColour(r.latestScore);
                  return (
                    <button
                      key={r.id}
                      onMouseDown={() => select(r.id, r.name)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full", c.bg, c.text)}>
                        {r.latestScore !== null ? `${r.latestScore} — ${c.label}` : "No data"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">CSM Name</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Emp ID</th>
                  <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-500">Latest Score</th>
                  <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-500">Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {summary.map((row, i) => {
                  const c = scoreColour(row.latestScore);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => select(row.id, row.name)}
                      className={clsx(
                        "cursor-pointer transition-colors group",
                        selectedId === row.id ? "bg-indigo-50" : "hover:bg-gray-50/60"
                      )}
                    >
                      <td className="py-2.5 px-4 text-xs text-gray-300">{i + 1}</td>
                      <td className="py-2.5 px-4">
                        <p className={clsx("text-xs font-semibold", selectedId === row.id ? "text-indigo-700" : "text-gray-800")}>{row.name}</p>
                        {row.designation && <p className="text-[10px] text-gray-400 mt-0.5">{row.designation}</p>}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{row.empId ?? "—"}</td>
                      <td className="py-2.5 px-4 text-center">
                        {row.latestScore !== null
                          ? <span className="text-xs font-bold text-gray-800">{row.latestScore}<span className="text-gray-400 font-normal">/100</span></span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={clsx("inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full", c.bg, c.text)}>
                          {c.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <ChevronRight size={14} className={clsx("transition-colors", selectedId === row.id ? "text-indigo-400" : "text-gray-200 group-hover:text-gray-400")} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-2">
          {selectedNJ ? (
            <div className="space-y-4 animate-scale-in">
              {/* Header card */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm mb-3">
                  {selectedNJ.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <h3 className="text-base font-bold">{selectedNJ.name}</h3>
                {selectedNJ.designation && <p className="text-indigo-200 text-xs mt-0.5">{selectedNJ.designation}</p>}
                {selectedNJ.empId && <p className="text-indigo-300 text-xs mt-0.5">ID: {selectedNJ.empId}</p>}
              </div>

              {/* Latest score summary */}
              {latestScore && (() => {
                const c = scoreColour(latestScore.score);
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Latest Score</p>
                      <p className="text-3xl font-black text-gray-900 mt-0.5">{latestScore.score}<span className="text-base font-normal text-gray-400">/100</span></p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(latestScore.date)}</p>
                    </div>
                    <span className={clsx("text-sm font-bold px-3 py-1.5 rounded-xl", c.bg, c.text)}>{c.label}</span>
                  </div>
                );
              })()}

              {/* Trend chart */}
              {trendData.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Score Trend</p>
                  <TrendLineChart data={trendData} />
                </div>
              )}

              {/* Score history table */}
              {scores && scores.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Score History</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {[...scores].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(s => {
                      const c = scoreColour(s.score);
                      return (
                        <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{s.score}<span className="text-gray-400 font-normal">/100</span></p>
                            <p className="text-[10px] text-gray-400">{fmtDate(s.date)}</p>
                          </div>
                          <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full", c.bg, c.text)}>
                            {c.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {scores && scores.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400">
                  No score history available
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 bg-white rounded-2xl border border-dashed border-gray-200 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Search size={24} className="text-indigo-400" />
              </div>
              <p className="text-gray-700 font-semibold">Select a CSM</p>
              <p className="text-sm text-gray-400 mt-1">Click a row or search above to view qubit details.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
