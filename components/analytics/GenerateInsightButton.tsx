"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GenerateInsightButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analytics/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error("Could not generate insight.");
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not generate insight.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" onClick={generateInsight} disabled={loading} className="h-9">
        {loading ? <Loader2 className="size-4 animate-app-spin" /> : <Brain className="size-4" />}
        {loading ? "Generating" : "Generate insight"}
      </Button>
      {error && <span className="max-w-48 text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}
