"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Single handle input → POST /api/cards/generate → redirect to the
 * receipt at /c/[slug]. Shows a friendly "reading…" state while the
 * Hiker + LLM pipeline runs (a few seconds).
 */
export default function HandleForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const value = handle.trim();
    if (!value) {
      setError("Enter your Instagram handle.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: value }),
      });
      const data = (await resp.json()) as { slug?: string; message?: string };
      if (!resp.ok || !data.slug) {
        setError(data.message ?? "Couldn't read that profile. Try again.");
        setLoading(false);
        return;
      }
      router.push(`/c/${data.slug}`);
    } catch {
      setError("Network hiccup. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div
        className="flex items-center rounded-full px-5 transition-colors focus-within:border-[var(--color-stan-400)]"
        style={{
          background: "var(--color-canvas-2)",
          border: "1px solid rgba(166,161,255,0.22)",
          height: 56,
        }}
      >
        <span className="text-[16px] font-sans" style={{ color: "rgba(243,239,230,0.5)" }}>
          @
        </span>
        <input
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            if (error) setError(null);
          }}
          disabled={loading}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="yourhandle"
          aria-label="Instagram handle"
          className="flex-1 bg-transparent outline-none text-[16px] pl-1.5 font-sans"
          style={{ color: "#f3efe6" }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="stan-gradient-bg w-full rounded-full flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-70 font-sans text-white"
        style={{
          height: 56,
          fontWeight: 700,
          fontSize: 15.5,
          letterSpacing: "0.01em",
          boxShadow: "0 14px 34px -10px rgba(168,86,232,0.6)",
        }}
      >
        {loading ? (
          <>
            <span
              className="inline-block w-4 h-4 rounded-full animate-spin"
              style={{ border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff" }}
            />
            Reading your feed…
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stanley-mark.png" alt="" width={22} height={22} className="-ml-1" />
            Print my receipt
          </>
        )}
      </button>

      {error && (
        <p className="text-[12.5px] font-sans" style={{ color: "#ffb4c4" }}>
          {error}
        </p>
      )}
    </form>
  );
}
