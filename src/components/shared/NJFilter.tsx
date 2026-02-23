"use client";

import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";

interface NJFilterProps {
  value: Id<"newJoiners"> | "all";
  onChange: (value: Id<"newJoiners"> | "all") => void;
}

export function NJFilter({ value, onChange }: NJFilterProps) {
  const njs = useQuery(api.queries.newJoiners.list, {});

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="nj-filter" className="text-xs font-medium text-gray-600">
        NJ:
      </label>
      <select
        id="nj-filter"
        value={value}
        onChange={(e) => onChange(e.target.value as Id<"newJoiners"> | "all")}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
      >
        <option value="all">All New Joiners</option>
        {njs?.map((nj: Doc<"newJoiners">) => (
          <option key={nj._id} value={nj._id}>
            {nj.name}
          </option>
        ))}
      </select>
    </div>
  );
}
