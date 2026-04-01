"use client";

import React from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  searchInput: string;
  onSearchChange: (v: string) => void;
  showFlagged: boolean;
  onToggleFlagged: (v: boolean) => void;
  onSearchSubmit?: (v: string) => void;
}

export default function SearchBar({
  searchInput,
  onSearchChange,
  showFlagged,
  onToggleFlagged,
  onSearchSubmit,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder="Buscar por email..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearchSubmit?.(searchInput);
            }
          }}
          className="pl-9 pr-4 py-2 border rounded-md text-sm w-60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        {/* Search button */}
        <button
          type="button"
          onClick={() => onSearchSubmit?.(searchInput)}
          className="ml-2 inline-flex items-center px-3 py-2 bg-primary text-white rounded-md text-sm hover:opacity-95"
        >
          Buscar
        </button>
      </div>

      <div className="flex items-center gap-2 border-l pl-3">
        <Switch id="filter-flagged" checked={showFlagged} onCheckedChange={onToggleFlagged} />
        <Label htmlFor="filter-flagged" className="text-sm cursor-pointer">
          Apenas alertas
        </Label>
      </div>
    </div>
  );
}