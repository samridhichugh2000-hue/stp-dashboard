"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { X, Send, Plus, Trash2 } from "lucide-react";

type Template = "PA" | "PIP" | "EXIT" | "Custom";

interface Props {
  njId?:       number;
  njName?:     string;
  template?:   Template;
  defaultTo?:  string[];
  triggeredAt?: string;
  onClose:     () => void;
  onSent?:     () => void;
}

const TEMPLATE_LABELS: Record<Template, string> = {
  PA:     "PA Notice",
  PIP:    "PIP Notice",
  EXIT:   "Exit Review Notice",
  Custom: "Custom Message",
};

export function EmailComposer({ njId, njName, template: initTemplate, defaultTo, triggeredAt, onClose, onSent }: Props) {
  const [template,    setTemplate]    = useState<Template>(initTemplate ?? "Custom");
  const [toList,      setToList]      = useState<string[]>(defaultTo ?? []);
  const [toInput,     setToInput]     = useState("");
  const [subject,     setSubject]     = useState("");
  const [customBody,  setCustomBody]  = useState("");
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [sent,        setSent]        = useState(false);

  function addEmail() {
    const e = toInput.trim().toLowerCase();
    if (e && e.includes("@") && !toList.includes(e)) {
      setToList(prev => [...prev, e]);
    }
    setToInput("");
  }

  async function handleSend() {
    if (toList.length === 0) { setError("Add at least one recipient."); return; }
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          njId,
          njName,
          to: toList,
          template,
          subject: subject || undefined,
          customBody: template === "Custom" ? customBody : undefined,
          triggeredAt,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Send failed");
      }
      setSent(true);
      onSent?.();
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {sent ? "Email Sent ✓" : "Send Email"}
            </p>
            {njName && <p className="text-[11px] text-gray-400 mt-0.5">Re: {njName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Send size={20} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-emerald-700">Email sent successfully</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Template selector */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Template</label>
              <div className="flex flex-wrap gap-2">
                {(["PA", "PIP", "EXIT", "Custom"] as Template[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTemplate(t)}
                    className={clsx(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
                      template === t
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
                    )}
                  >
                    {TEMPLATE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* To field */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">To</label>
              <div className="flex flex-wrap gap-1.5 border border-gray-200 rounded-lg p-2 min-h-[40px] focus-within:ring-2 focus-within:ring-indigo-300">
                {toList.map(e => (
                  <span key={e} className="flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                    {e}
                    <button onClick={() => setToList(prev => prev.filter(x => x !== e))}>
                      <Trash2 size={10} className="hover:text-red-500" />
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  value={toInput}
                  onChange={e => setToInput(e.target.value)}
                  onKeyDown={e => (e.key === "Enter" || e.key === ",") && (e.preventDefault(), addEmail())}
                  onBlur={addEmail}
                  placeholder="Add email…"
                  className="flex-1 min-w-[140px] text-xs outline-none bg-transparent"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Press Enter or comma to add</p>
            </div>

            {/* Subject override (optional) */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Subject <span className="font-normal text-gray-400">(optional override)</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={`Auto: "${TEMPLATE_LABELS[template]}${njName ? ` — ${njName}` : ""}"`}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Custom body */}
            {template === "Custom" && (
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Message</label>
                <textarea
                  value={customBody}
                  onChange={e => setCustomBody(e.target.value)}
                  rows={4}
                  placeholder="Type your message…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className={clsx(
                  "flex-1 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-1.5 transition-colors",
                  sending && "opacity-60 cursor-not-allowed"
                )}
              >
                <Send size={12} />
                {sending ? "Sending…" : "Send Email"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
