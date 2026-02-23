"use client";

import { clsx } from "clsx";
import { format } from "date-fns";

interface QubitScore {
  _id: string;
  date: string;
  score: number;
  category: string;
  recordingsCompleted: number;
}

interface ScoreTableProps {
  scores: QubitScore[];
}

function scoreClass(score: number) {
  if (score >= 70) return "bg-emerald-100 text-emerald-800";
  if (score >= 50) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function scoreLabel(score: number) {
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Below target";
}

export function ScoreTable({ scores }: ScoreTableProps) {
  if (scores.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No qubit scores available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Date</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Category</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Score</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Recordings</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {scores.map((s) => (
            <tr key={s._id} className="hover:bg-gray-50 transition-colors">
              <td className="py-2 px-3 text-gray-600">
                {format(new Date(s.date), "dd MMM yyyy")}
              </td>
              <td className="py-2 px-3 text-gray-700">{s.category}</td>
              <td className="py-2 px-3 text-center">
                <span className="font-semibold text-gray-900">{s.score}</span>
                <span className="text-gray-400">/100</span>
              </td>
              <td className="py-2 px-3 text-center text-gray-600">{s.recordingsCompleted}</td>
              <td className="py-2 px-3">
                <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", scoreClass(s.score))}>
                  {scoreLabel(s.score)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
