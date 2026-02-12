"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ShowcaseItem = {
  themeId: string;
  themeName: string;
  themeDescription: string;
  colors: Record<string, string>;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  distance: number;
  note: string;
  relativePath: string | null;
  previewUrl: string | null;
};

type ShowcaseResponse = {
  items: ShowcaseItem[];
  generatedAt: string | null;
  errors: string[];
};

function cardBackground(colors: Record<string, string>): string {
  const top = colors.bg ?? "#f3f4f6";
  const mid = colors.gradient_color ?? colors.water ?? "#dbeafe";
  const bottom = colors.text ?? "#d1d5db";
  return `linear-gradient(145deg, ${top}, ${mid} 58%, ${bottom})`;
}

export function ThemeShowcase() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const continueLinkRef = useRef<HTMLAnchorElement | null>(null);

  const generatedCount = useMemo(() => items.filter((item) => item.previewUrl).length, [items]);
  const missingCount = Math.max(0, items.length - generatedCount);
  const hasItems = items.length > 0;

  useEffect(() => {
    const loadShowcase = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/showcase", { cache: "no-store" });
        const data = (await response.json()) as ShowcaseResponse | { error?: string };
        if (!response.ok || !("items" in data)) {
          throw new Error(("error" in data && data.error) || "Failed to load theme showcase.");
        }

        setItems(data.items);
        setGeneratedAt(data.generatedAt);
        setErrors(data.errors);
        setSelectedThemeId((previous) => {
          if (previous && data.items.some((item) => item.themeId === previous)) {
            return previous;
          }

          return data.items[0]?.themeId ?? "";
        });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load showcase.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadShowcase();
  }, []);

  const generateShowcase = async (regenerate: boolean) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate })
      });

      const data = (await response.json()) as ShowcaseResponse | { error?: string };
      if (!response.ok || !("items" in data)) {
        throw new Error(("error" in data && data.error) || "Failed to generate showcase previews.");
      }

      setItems(data.items);
      setGeneratedAt(data.generatedAt);
      setErrors(data.errors);
      setSelectedThemeId((previous) => {
        if (previous && data.items.some((item) => item.themeId === previous)) {
          return previous;
        }

        return data.items[0]?.themeId ?? "";
      });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate previews.");
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedItem = useMemo(
    () => items.find((item) => item.themeId === selectedThemeId) ?? null,
    [items, selectedThemeId]
  );
  const detailsHref = selectedItem
    ? `/details?theme=${encodeURIComponent(selectedItem.themeId)}`
    : "/details";

  const onSelectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);

    if (typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      continueLinkRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      continueLinkRef.current?.focus();
    }, 0);
  };

  if (isLoading) {
    return <p className="loading-copy">Loading theme showcase...</p>;
  }

  return (
    <section className="theme-showcase" aria-label="Theme gallery">
      <header className="showcase-header">
        <p className="eyebrow">Step 1</p>
        <h1>Pick a theme</h1>
        <p>
          Tap one card, then continue. You can customize map and export settings in the next step.
        </p>
      </header>

      <section className="showcase-actions" aria-label="Theme preview generation tools">
        <p>
          Generated previews: <strong>{generatedCount}</strong> / <strong>{items.length}</strong>
          {generatedAt ? ` | Last run: ${new Date(generatedAt).toLocaleString()}` : ""}
        </p>
        {isDevelopment ? (
          <div className="showcase-action-row">
            {missingCount > 0 ? (
              <button type="button" onClick={() => void generateShowcase(false)} disabled={isGenerating}>
                {isGenerating ? "Generating maps..." : `Generate Missing Previews (${missingCount})`}
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-button"
              onClick={() => void generateShowcase(true)}
              disabled={isGenerating}
            >
              Regenerate All {items.length}
            </button>
          </div>
        ) : null}
        {errors.length > 0 ? <p className="error-copy">Some previews failed: {errors.join(" | ")}</p> : null}
        {error ? <p className="error-copy">{error}</p> : null}
      </section>

      {hasItems ? (
        <>
          <div className="theme-grid" role="listbox" aria-label="Theme options">
            {items.map((item) => {
              const isSelected = item.themeId === selectedThemeId;

              return (
                <article
                  key={item.themeId}
                  className={`theme-card${isSelected ? " is-selected" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <button
                    type="button"
                    className="theme-card-select"
                    onClick={() => onSelectTheme(item.themeId)}
                    aria-pressed={isSelected}
                  >
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={`${item.themeName} preview`} className="theme-preview" />
                    ) : (
                      <div className="theme-preview theme-preview-placeholder" style={{ background: cardBackground(item.colors) }}>
                        <span>Preview pending</span>
                        <small>{isDevelopment ? 'Run "Generate Missing Previews"' : "Preview unavailable"}</small>
                      </div>
                    )}

                    <div className="theme-card-body">
                      <p className="theme-card-title">
                        {item.themeName} <span>({item.themeId})</span>
                      </p>
                      <p className="theme-card-location">
                        {item.city}, {item.country}
                      </p>
                      <p className="theme-card-note">{item.note}</p>
                      <p className="theme-card-description">{item.themeDescription}</p>
                      <span className="theme-card-check">{isSelected ? "Selected" : "Tap to select"}</span>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>

          <div className="theme-selection-footer">
            <p>
              Selected theme: <strong>{selectedItem?.themeName ?? "None"}</strong>
            </p>
            <Link ref={continueLinkRef} className="theme-continue-link" href={detailsHref}>
              Continue
            </Link>
          </div>
        </>
      ) : (
        <p className="loading-copy">No theme previews are available right now. Refresh to try loading again.</p>
      )}
    </section>
  );
}
