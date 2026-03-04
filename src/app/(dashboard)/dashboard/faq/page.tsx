"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import {
  FileText, HelpCircle, Plus, Trash2,
  ChevronDown, ChevronUp, X, Search, Pencil, Link, ExternalLink,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_CATEGORIES = ["SOS", "Training Plan", "Policy", "Other"];

const CAT_COLORS: Record<string, string> = {
  "SOS":           "bg-red-100 text-red-700 ring-red-200/60",
  "Training Plan": "bg-violet-100 text-violet-700 ring-violet-200/60",
  "Policy":        "bg-amber-100 text-amber-700 ring-amber-200/60",
  "Other":         "bg-gray-100 text-gray-600 ring-gray-200/60",
};

const CAT_ICON_COLORS: Record<string, string> = {
  "SOS":           "from-red-400 to-rose-500",
  "Training Plan": "from-violet-400 to-purple-500",
  "Policy":        "from-amber-400 to-orange-500",
  "Other":         "from-slate-400 to-gray-500",
};

function fileIcon(type: string | undefined) {
  const t = (type ?? "").toLowerCase();
  if (t === "pdf")                      return "📄";
  if (t === "docx" || t === "doc")      return "📝";
  if (t === "xlsx" || t === "xls")      return "📊";
  if (t === "pptx" || t === "ppt")      return "📋";
  return "📎";
}

function fmtSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Add Link Modal ───────────────────────────────────────────────────────────

function AddLinkModal({ onClose }: { onClose: () => void }) {
  const createDoc = useMutation(api.mutations.documents.create);

  const [title,       setTitle]       = useState("");
  const [linkUrl,     setLinkUrl]     = useState("");
  const [category,    setCategory]    = useState(DOC_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !linkUrl.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createDoc({
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        linkUrl: linkUrl.trim(),
        uploadedBy: "Admin",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Add Document Link</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={17} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Document Name *</label>
            <input required type="text" placeholder="e.g. SOS Procedure 2026"
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 focus:bg-white transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Link URL *</label>
            <input required type="url" placeholder="https://docs.google.com/…"
              value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 focus:bg-white transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Category *</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 cursor-pointer">
              {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Description</label>
            <textarea rows={2} placeholder="Optional short description…"
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 focus:bg-white transition-colors resize-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !title.trim() || !linkUrl.trim()}
              className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
              {saving ? "Saving…" : "Add Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── FAQ Modal ────────────────────────────────────────────────────────────────

function FAQModal({
  initial,
  onClose,
}: {
  initial?: { id: Id<"faqs">; question: string; answer: string; category?: string };
  onClose: () => void;
}) {
  const createFAQ = useMutation(api.mutations.faqs.create);
  const updateFAQ = useMutation(api.mutations.faqs.update);

  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer,   setAnswer]   = useState(initial?.answer ?? "");
  const [category, setCategory] = useState(initial?.category ?? "General");
  const [saving,   setSaving]   = useState(false);

  const FAQ_CATS = ["General", "Leave Policy", "Training", "Performance", "Other"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await updateFAQ({ id: initial.id, question: question.trim(), answer: answer.trim(), category });
      } else {
        await createFAQ({ question: question.trim(), answer: answer.trim(), category });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">{initial ? "Edit FAQ" : "Add FAQ"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={17} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 cursor-pointer">
              {FAQ_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Question *</label>
            <input required type="text" placeholder="e.g. How do I apply for leave?"
              value={question} onChange={e => setQuestion(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 focus:bg-white transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Answer *</label>
            <textarea required rows={4} placeholder="Write a clear, concise answer…"
              value={answer} onChange={e => setAnswer(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 focus:bg-white transition-colors resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !question.trim() || !answer.trim()}
              className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : initial ? "Save Changes" : "Add FAQ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [tab,          setTab]          = useState<"documents" | "faq">("documents");
  const [docCatFilter, setDocCatFilter] = useState("All");
  const [docSearch,    setDocSearch]    = useState("");
  const [faqSearch,    setFaqSearch]    = useState("");
  const [openFAQ,      setOpenFAQ]      = useState<string | null>(null);
  const [showAddLink,  setShowAddLink]  = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [editingFAQ,   setEditingFAQ]   = useState<{ id: Id<"faqs">; question: string; answer: string; category?: string } | null>(null);

  const documents = useQuery(api.queries.documents.list);
  const faqs      = useQuery(api.queries.faqs.list);
  const removeDoc = useMutation(api.mutations.documents.remove);
  const removeFAQ = useMutation(api.mutations.faqs.remove);

  // ── Document filtering ──────────────────────────────────────────────────────
  const filteredDocs = (documents ?? []).filter(d => {
    const matchesCat    = docCatFilter === "All" || d.category === docCatFilter;
    const matchesSearch = !docSearch || d.title.toLowerCase().includes(docSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const docCounts = DOC_CATEGORIES.reduce((acc, c) => {
    acc[c] = (documents ?? []).filter(d => d.category === c).length;
    return acc;
  }, {} as Record<string, number>);

  // ── FAQ filtering ──────────────────────────────────────────────────────────
  const filteredFAQs = (faqs ?? []).filter(f =>
    !faqSearch ||
    f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
    f.answer.toLowerCase().includes(faqSearch.toLowerCase())
  );

  // Group FAQs by category
  const faqGroups = filteredFAQs.reduce((acc, faq) => {
    const cat = faq.category ?? "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {} as Record<string, typeof filteredFAQs>);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQ &amp; Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Training resources, policies and common questions</p>
        </div>
        <button
          onClick={() => tab === "documents" ? setShowAddLink(true) : setShowFAQModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
        >
          <Plus size={15} />
          {tab === "documents" ? "Add Document" : "Add FAQ"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["documents", "faq"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "documents" ? (
              <span className="flex items-center gap-1.5"><FileText size={14} /> Documents {documents ? `(${documents.length})` : ""}</span>
            ) : (
              <span className="flex items-center gap-1.5"><HelpCircle size={14} /> FAQ {faqs ? `(${faqs.length})` : ""}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Documents Tab ────────────────────────────────────────────────────── */}
      {tab === "documents" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="text" placeholder="Search documents…" value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-colors placeholder-gray-400" />
            </div>
            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              {["All", ...DOC_CATEGORIES].map(cat => (
                <button key={cat} onClick={() => setDocCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    docCatFilter === cat
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                  }`}>
                  {cat}{cat !== "All" && docCounts[cat] > 0 && <span className={`ml-1 ${docCatFilter === cat ? "text-white/70" : "text-gray-400"}`}>{docCounts[cat]}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Document grid */}
          {!documents ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-40 rounded-2xl" />)}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center mb-4 shadow-lg">
                <FileText size={24} className="text-white" />
              </div>
              <p className="text-gray-700 font-semibold">No documents yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload your first document using the button above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map(doc => (
                <a key={doc._id}
                  href={(doc.linkUrl ?? doc.url) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all p-5 flex flex-col gap-3 cursor-pointer group no-underline block">
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${CAT_ICON_COLORS[doc.category] ?? "from-slate-400 to-gray-500"} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <Link size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug truncate group-hover:text-indigo-700 transition-colors">{doc.title}</p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${CAT_COLORS[doc.category] ?? "bg-gray-100 text-gray-600 ring-gray-200/60"}`}>
                        {doc.category}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {doc.description && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{doc.description}</p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-gray-400">{fmtDate(doc.uploadedAt)}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-indigo-500 font-medium group-hover:text-indigo-700 transition-colors flex items-center gap-1">
                        <ExternalLink size={10} /> View
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); removeDoc({ id: doc._id as Id<"documents"> }); }}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FAQ Tab ──────────────────────────────────────────────────────────── */}
      {tab === "faq" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Search FAQs…" value={faqSearch}
              onChange={e => setFaqSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-colors placeholder-gray-400" />
          </div>

          {!faqs ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-14 rounded-2xl" />)}
            </div>
          ) : filteredFAQs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center mb-4 shadow-lg">
                <HelpCircle size={24} className="text-white" />
              </div>
              <p className="text-gray-700 font-semibold">No FAQs yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first FAQ using the button above.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(faqGroups).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{cat}</p>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                    {items.map(faq => {
                      const isOpen = openFAQ === faq._id;
                      return (
                        <div key={faq._id}>
                          <div
                            onClick={() => setOpenFAQ(isOpen ? null : faq._id)}
                            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/60 transition-colors group cursor-pointer"
                          >
                            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                              <HelpCircle size={13} />
                            </div>
                            <p className="flex-1 text-sm font-semibold text-gray-800">{faq.question}</p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={e => { e.stopPropagation(); setEditingFAQ({ id: faq._id as Id<"faqs">, question: faq.question, answer: faq.answer, category: faq.category }); }}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all">
                                <Pencil size={12} />
                              </button>
                              <button onClick={e => { e.stopPropagation(); removeFAQ({ id: faq._id as Id<"faqs"> }); }}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 size={12} />
                              </button>
                              {isOpen ? <ChevronUp size={15} className="text-indigo-500" /> : <ChevronDown size={15} className="text-gray-400" />}
                            </div>
                          </div>
                          {isOpen && (
                            <div className="px-5 pb-4 pt-0">
                              <div className="ml-9 text-sm text-gray-600 leading-relaxed bg-indigo-50/40 rounded-xl px-4 py-3 border border-indigo-100/60">
                                {faq.answer}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddLink && <AddLinkModal onClose={() => setShowAddLink(false)} />}
      {(showFAQModal || editingFAQ) && (
        <FAQModal
          initial={editingFAQ ?? undefined}
          onClose={() => { setShowFAQModal(false); setEditingFAQ(null); }}
        />
      )}
    </div>
  );
}
