"use client";

import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  LayoutTemplate,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortfolioPersistAction } from "../types";

type BuilderToolbarProps = {
  onPersist: (action: PortfolioPersistAction) => void;
  isSaving: boolean;
  dirty: boolean;
  onLocalSave?: () => void;
  isAuthenticated: boolean;
};

/**
 * Top toolbar for save, export, publish, and navigation actions.
 */
export function BuilderToolbar({
  onPersist,
  isSaving,
  dirty,
  onLocalSave,
  isAuthenticated,
}: BuilderToolbarProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push("/portfolio/templates")}
        >
          <LayoutTemplate className="h-4 w-4" />
          Templates
        </Button>
        <span
          className="hidden text-xs text-ink/50 sm:inline"
          aria-live="polite"
        >
          {dirty ? "Unsaved changes" : "All changes synced locally"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!isAuthenticated && onLocalSave && (
          <Button type="button" variant="ghost" size="sm" onClick={onLocalSave}>
            <Eye className="h-4 w-4" />
            Save draft locally
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isSaving}
          onClick={() => onPersist("save")}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={() => onPersist("export")}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSaving}
          className="bg-green-600"
          onClick={() => onPersist("publish")}
        >
          <Send className="h-4 w-4" />
          Publish
        </Button>
      </div>
    </div>
  );
}
