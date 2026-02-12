"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  buildGenerationFailure,
  readGenerateResponse
} from "@/app/_lib/poster/client-generation";
import { COUNTRY_OPTIONS } from "@/app/_lib/poster/countries";
import type { MarkerIcon } from "@/app/_lib/poster/types";

type ThemeSummary = {
  id: string;
  name: string;
  description: string;
};

type PosterOutput = {
  relativePath: string;
  fileName: string;
  format: string;
  downloadUrl: string;
  previewUrl: string | null;
};

type SizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

type FontOption = {
  id: string;
  label: string;
  family: string;
};

type CenterMode = "city" | "coordinates";

const OUTPUT_DPI = 300;
const CUSTOM_SIZE_PRESET_ID = "custom";

const SIZE_PRESETS: SizePreset[] = [
  { id: "poster_12x16", label: "Poster 12 x 16 in", width: 12, height: 16 },
  { id: "a4_portrait", label: "A4 portrait", width: 8.27, height: 11.69 },
  { id: "a3_portrait", label: "A3 portrait", width: 11.69, height: 16.54 },
  { id: "instagram_square", label: "Instagram square", width: 3.6, height: 3.6 },
  { id: "story_portrait", label: "Story portrait", width: 3.6, height: 6.4 },
  { id: "hd_landscape", label: "HD wallpaper", width: 6.4, height: 3.6 },
  { id: "4k_landscape", label: "4K wallpaper", width: 12.8, height: 7.2 }
];

const FONT_OPTIONS: FontOption[] = [
  { id: "Roboto", label: "Roboto (Default)", family: "Roboto" },
  { id: "Inter", label: "Inter", family: "Inter" },
  { id: "Lato", label: "Lato", family: "Lato" },
  { id: "Montserrat", label: "Montserrat", family: "Montserrat" },
  { id: "Poppins", label: "Poppins", family: "Poppins" },
  { id: "Raleway", label: "Raleway", family: "Raleway" },
  { id: "Playfair Display", label: "Playfair Display", family: "Playfair Display" },
  { id: "Merriweather", label: "Merriweather", family: "Merriweather" },
  { id: "Source Serif 4", label: "Source Serif 4", family: "Source Serif 4" },
  { id: "Noto Sans", label: "Noto Sans", family: "Noto Sans" },
  { id: "Noto Serif", label: "Noto Serif", family: "Noto Serif" },
  { id: "Oswald", label: "Oswald", family: "Oswald" }
];

const MARKER_ICON_OPTIONS: Array<{ value: MarkerIcon; label: string }> = [
  { value: "dot", label: "Dot" },
  { value: "plus", label: "Plus" },
  { value: "star", label: "Star" },
  { value: "none", label: "None" }
];

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function findMatchingPreset(width: number, height: number): SizePreset | undefined {
  return SIZE_PRESETS.find((preset) => nearlyEqual(preset.width, width) && nearlyEqual(preset.height, height));
}

function exportPixelsLabel(width: number, height: number): string {
  return `${Math.round(width * OUTPUT_DPI)} x ${Math.round(height * OUTPUT_DPI)} px @ ${OUTPUT_DPI} DPI`;
}

type FormState = {
  centerMode: CenterMode;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  showMarker: boolean;
  markerColor: string;
  markerIcon: MarkerIcon;
  countryLabel: string;
  theme: string;
  allThemes: boolean;
  distance: number;
  sizePreset: string;
  width: number;
  height: number;
  displayCity: string;
  displayCountry: string;
  fontPreset: string;
  customFontFamily: string;
  format: "png" | "svg" | "pdf";
};

const defaultState: FormState = {
  centerMode: "city",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
  showMarker: false,
  markerColor: "#d62828",
  markerIcon: "dot",
  countryLabel: "",
  theme: "terracotta",
  allThemes: false,
  distance: 18000,
  sizePreset: "a4_portrait",
  width: 8.27,
  height: 11.69,
  displayCity: "",
  displayCountry: "",
  fontPreset: "Roboto",
  customFontFamily: "",
  format: "png"
};

export function PosterStudio() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [form, setForm] = useState<FormState>(defaultState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputs, setOutputs] = useState<PosterOutput[]>([]);
  const [expandedOutputIds, setExpandedOutputIds] = useState<Set<string>>(() => new Set());
  const [isCustomDimensionsOpen, setIsCustomDimensionsOpen] = useState(false);
  const [logs, setLogs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);

  useEffect(() => {
    const loadThemes = async () => {
      try {
        const response = await fetch("/api/themes", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load themes");
        }
        const data = (await response.json()) as { themes: ThemeSummary[] };
        setThemes(data.themes);
        if (data.themes.length > 0) {
          setForm((previous) => ({ ...previous, theme: data.themes[0].id }));
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load themes");
      }
    };

    void loadThemes();
  }, []);

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.id === form.theme),
    [themes, form.theme]
  );
  const exportPixels = useMemo(() => exportPixelsLabel(form.width, form.height), [form.width, form.height]);
  const selectedFontOption = useMemo(
    () => FONT_OPTIONS.find((option) => option.id === form.fontPreset),
    [form.fontPreset]
  );
  const isCityCenterMode = form.centerMode === "city";

  useEffect(() => {
    if (form.sizePreset === CUSTOM_SIZE_PRESET_ID) {
      setIsCustomDimensionsOpen(true);
    }
  }, [form.sizePreset]);

  useEffect(() => {
    if (outputs.length === 0) {
      setExpandedOutputIds(new Set());
      return;
    }

    const newestOutput = outputs[outputs.length - 1];
    if (!newestOutput) {
      setExpandedOutputIds(new Set());
      return;
    }

    setExpandedOutputIds(new Set([newestOutput.relativePath]));
  }, [outputs]);

  const onCenterModeChange = (mode: CenterMode) => {
    setForm((previous) =>
      mode === "city"
        ? { ...previous, centerMode: "city", latitude: "", longitude: "" }
        : { ...previous, centerMode: "coordinates", city: "", country: "" }
    );
  };

  const onCityOrCountryChange = (field: "city" | "country", value: string) => {
    setForm((previous) => {
      const previousValue = previous[field].trim().toLowerCase();
      const nextValue = value.trim().toLowerCase();
      const didChange = previousValue !== nextValue;

      if (!didChange) {
        return { ...previous, [field]: value };
      }

      return {
        ...previous,
        [field]: value,
        latitude: "",
        longitude: ""
      };
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);
    setErrorDetails([]);
    setErrorTechnical(null);
    setLogs("");
    setOutputs([]);

    try {
      const resolvedFontFamily =
        form.fontPreset === "custom"
          ? form.customFontFamily.trim() || undefined
          : selectedFontOption?.family === "Roboto"
            ? undefined
            : selectedFontOption?.family;

      const cityValue = form.city.trim();
      const countryValue = form.country.trim();
      const latitudeValue = form.latitude.trim();
      const longitudeValue = form.longitude.trim();

      if (isCityCenterMode && (!cityValue || !countryValue)) {
        throw new Error("City and country are required when using city center mode.");
      }

      if (!isCityCenterMode && (!latitudeValue || !longitudeValue)) {
        throw new Error("Latitude and longitude are required when using coordinate center mode.");
      }

      const payload = {
        city: isCityCenterMode ? cityValue : "",
        country: isCityCenterMode ? countryValue : "",
        latitude: isCityCenterMode ? undefined : latitudeValue || undefined,
        longitude: isCityCenterMode ? undefined : longitudeValue || undefined,
        showMarker: form.showMarker,
        markerColor: form.markerColor,
        markerIcon: form.markerIcon,
        countryLabel: form.countryLabel || undefined,
        theme: form.theme,
        allThemes: form.allThemes,
        distance: form.distance,
        width: form.width,
        height: form.height,
        displayCity: form.displayCity || undefined,
        displayCountry: form.displayCountry || undefined,
        fontFamily: resolvedFontFamily,
        format: form.format
      };

      const response = await fetch("/api/posters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const { data, rawText } = await readGenerateResponse(response);

      if (!response.ok) {
        const failure = buildGenerationFailure(response.status, data, rawText);
        setError(failure.message);
        setErrorDetails(failure.details);
        setErrorTechnical(failure.technical);
        return;
      }

      if (!data) {
        setError("Poster generation failed: invalid server response.");
        setErrorDetails(["The API returned non-JSON output."]);
        setErrorTechnical(rawText.trim().slice(0, 8000) || null);
        return;
      }

      setOutputs(data.outputs ?? []);
      setLogs([data.logs, data.stderr].filter(Boolean).join("\n\n"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Poster generation failed");
      setErrorDetails([]);
      setErrorTechnical(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const onSizePresetChange = (presetId: string) => {
    setForm((previous) => {
      if (presetId === CUSTOM_SIZE_PRESET_ID) {
        return { ...previous, sizePreset: CUSTOM_SIZE_PRESET_ID };
      }

      const preset = SIZE_PRESETS.find((item) => item.id === presetId);
      if (!preset) {
        return previous;
      }

      return {
        ...previous,
        sizePreset: preset.id,
        width: preset.width,
        height: preset.height
      };
    });
  };

  const onWidthChange = (raw: string) => {
    const width = Number(raw) || 8.27;
    setForm((previous) => {
      const matched = findMatchingPreset(width, previous.height);
      return {
        ...previous,
        width,
        sizePreset: matched?.id ?? CUSTOM_SIZE_PRESET_ID
      };
    });
  };

  const onHeightChange = (raw: string) => {
    const height = Number(raw) || 11.69;
    setForm((previous) => {
      const matched = findMatchingPreset(previous.width, height);
      return {
        ...previous,
        height,
        sizePreset: matched?.id ?? CUSTOM_SIZE_PRESET_ID
      };
    });
  };

  const onOutputDetailsToggle = (relativePath: string, isOpen: boolean) => {
    setExpandedOutputIds((previous) => {
      const next = new Set(previous);
      if (isOpen) {
        next.add(relativePath);
      } else {
        next.delete(relativePath);
      }
      return next;
    });
  };

  return (
    <section className="studio-shell" aria-label="Poster studio">
      <section className="studio-panel">
        <header className="studio-header">
          <p className="eyebrow">Poster Configuration</p>
          <h2>Design your poster in three steps</h2>
          <p>
            Configure location and style, choose export settings, then generate and download. All outputs use the same
            backend rendering pipeline.
          </p>
        </header>

        <form className="poster-form" onSubmit={onSubmit}>
          <fieldset className="form-step" id="step-configure">
            <legend>
              <span className="step-index">1</span>
              <span className="step-copy">
                <strong>Configure location and style</strong>
                <small>Define city data, theme, labels, and typography.</small>
              </span>
            </legend>

            <details className="form-accordion" open>
              <summary>Essentials</summary>
              <div className="form-accordion-content">
                <div className="center-mode-group" role="radiogroup" aria-label="Map center mode">
                  <p className="center-mode-title">Center Mode (choose one)</p>
                  <label className="radio-row">
                    <input
                      type="radio"
                      name="center-mode-studio"
                      checked={form.centerMode === "city"}
                      onChange={() => onCenterModeChange("city")}
                    />
                    Use city and country
                  </label>
                  <label className="radio-row">
                    <input
                      type="radio"
                      name="center-mode-studio"
                      checked={form.centerMode === "coordinates"}
                      onChange={() => onCenterModeChange("coordinates")}
                    />
                    Use exact coordinates
                  </label>
                </div>

                <label>
                  City
                  <input
                    value={form.city}
                    onChange={(event) => onCityOrCountryChange("city", event.target.value)}
                    required={isCityCenterMode}
                    disabled={!isCityCenterMode}
                    placeholder="Paris"
                  />
                </label>

                <label>
                  Country
                  <select
                    value={form.country}
                    onChange={(event) => onCityOrCountryChange("country", event.target.value)}
                    required={isCityCenterMode}
                    disabled={!isCityCenterMode}
                  >
                    <option value="" disabled>
                      Select a country
                    </option>
                    {COUNTRY_OPTIONS.map((countryName) => (
                      <option key={countryName} value={countryName}>
                        {countryName}
                      </option>
                    ))}
                  </select>
                </label>

                {!isCityCenterMode ? (
                  <p className="input-hint">City and country are disabled in coordinates mode.</p>
                ) : null}

                <label>
                  Theme
                  <select
                    value={form.theme}
                    onChange={(event) => setForm((prev) => ({ ...prev, theme: event.target.value }))}
                    disabled={form.allThemes}
                  >
                    {themes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                  {!form.allThemes && selectedTheme?.description ? (
                    <span className="input-hint">{selectedTheme.description}</span>
                  ) : null}
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.allThemes}
                    onChange={(event) => setForm((prev) => ({ ...prev, allThemes: event.target.checked }))}
                  />
                  Generate all themes
                </label>

                <label>
                  Distance (meters)
                  <input
                    type="number"
                    value={form.distance}
                    min={100}
                    onChange={(event) => setForm((prev) => ({ ...prev, distance: Number(event.target.value) || 100 }))}
                  />
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.showMarker}
                    onChange={(event) => setForm((prev) => ({ ...prev, showMarker: event.target.checked }))}
                  />
                  Add center pinpoint marker
                </label>

                {form.showMarker ? (
                  <div className="form-grid-two">
                    <label>
                      Marker Color
                      <input
                        type="color"
                        value={form.markerColor}
                        onChange={(event) => setForm((prev) => ({ ...prev, markerColor: event.target.value }))}
                        aria-label="Marker color"
                      />
                      <span className="input-hint">{form.markerColor.toUpperCase()}</span>
                    </label>

                    <label>
                      Marker Icon
                      <select
                        value={form.markerIcon}
                        onChange={(event) => setForm((prev) => ({ ...prev, markerIcon: event.target.value as MarkerIcon }))}
                      >
                        {MARKER_ICON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            </details>

            <details className="form-accordion">
              <summary>Advanced location</summary>
              <div className="form-accordion-content">
                <div className="form-grid-two">
                  <label>
                    Latitude {isCityCenterMode ? "(disabled in city mode)" : "(required in coordinates mode)"}
                    <input
                      value={form.latitude}
                      onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
                      placeholder="48.8566"
                      inputMode="decimal"
                      disabled={isCityCenterMode}
                    />
                  </label>

                  <label>
                    Longitude {isCityCenterMode ? "(disabled in city mode)" : "(required in coordinates mode)"}
                    <input
                      value={form.longitude}
                      onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
                      placeholder="2.3522"
                      inputMode="decimal"
                      disabled={isCityCenterMode}
                    />
                  </label>
                </div>

                <p className="input-hint">
                  Coordinates mode requires both latitude and longitude. City mode uses city/country geocoding only.
                </p>

                <label>
                  Country Label (optional)
                  <input
                    value={form.countryLabel}
                    onChange={(event) => setForm((prev) => ({ ...prev, countryLabel: event.target.value }))}
                    placeholder="FRENCH REPUBLIC"
                  />
                </label>

                <div className="form-grid-two">
                  <label>
                    Display City (optional)
                    <input
                      value={form.displayCity}
                      onChange={(event) => setForm((prev) => ({ ...prev, displayCity: event.target.value }))}
                      placeholder="Tokyo"
                    />
                  </label>

                  <label>
                    Display Country (optional)
                    <input
                      value={form.displayCountry}
                      onChange={(event) => setForm((prev) => ({ ...prev, displayCountry: event.target.value }))}
                      placeholder="Japan"
                    />
                  </label>
                </div>
              </div>
            </details>

            <details className="form-accordion">
              <summary>Typography</summary>
              <div className="form-accordion-content">
                <label>
                  Font Style
                  <select
                    value={form.fontPreset}
                    onChange={(event) => setForm((prev) => ({ ...prev, fontPreset: event.target.value }))}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font.id} value={font.id}>
                        {font.label}
                      </option>
                    ))}
                    <option value="custom">Custom Font</option>
                  </select>
                  <span className="input-hint">Choose a ready-to-use font style for poster labels.</span>
                </label>

                {form.fontPreset === "custom" ? (
                  <label>
                    Custom Font Family
                    <input
                      value={form.customFontFamily}
                      onChange={(event) => setForm((prev) => ({ ...prev, customFontFamily: event.target.value }))}
                      placeholder="Example: Noto Sans JP"
                    />
                    <span className="input-hint">
                      Enter any Google Font family name exactly as shown in Google Fonts.
                    </span>
                  </label>
                ) : null}
              </div>
            </details>
          </fieldset>

          <fieldset className="form-step" id="step-export">
            <legend>
              <span className="step-index">2</span>
              <span className="step-copy">
                <strong>Pick export size and format</strong>
                <small>Set print dimensions and file type output.</small>
              </span>
            </legend>

            <label>
              Export Size
              <select value={form.sizePreset} onChange={(event) => onSizePresetChange(event.target.value)}>
                {SIZE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} ({exportPixelsLabel(preset.width, preset.height)})
                  </option>
                ))}
                <option value={CUSTOM_SIZE_PRESET_ID}>Custom</option>
              </select>
              <span className="input-hint">
                Current export: {exportPixels}. Text is scaled proportionally for this size.
              </span>
            </label>

            <label>
              Output Format
              <select
                value={form.format}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    format: event.target.value as FormState["format"]
                  }))
                }
              >
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
                <option value="pdf">PDF</option>
              </select>
            </label>

            <details
              className="form-accordion"
              open={isCustomDimensionsOpen}
              onToggle={(event) => setIsCustomDimensionsOpen(event.currentTarget.open)}
            >
              <summary>Custom dimensions</summary>
              <div className="form-accordion-content">
                <div className="form-grid-two">
                  <label>
                    Width (inches)
                    <input
                      type="number"
                      value={form.width}
                      min={1}
                      max={20}
                      step={0.01}
                      onChange={(event) => onWidthChange(event.target.value)}
                    />
                  </label>

                  <label>
                    Height (inches)
                    <input
                      type="number"
                      value={form.height}
                      min={1}
                      max={20}
                      step={0.01}
                      onChange={(event) => onHeightChange(event.target.value)}
                    />
                  </label>
                </div>
              </div>
            </details>
          </fieldset>

          <fieldset className="form-step step-submit" id="step-generate">
            <legend>
              <span className="step-index">3</span>
              <span className="step-copy">
                <strong>Generate and download instantly</strong>
                <small>Review the setup and run generation.</small>
              </span>
            </legend>

            <p className="step-summary">
              <strong>Ready:</strong>{" "}
              {isCityCenterMode
                ? form.city && form.country
                  ? `${form.city}, ${form.country}`
                  : "Select a city and country"
                : form.latitude.trim() && form.longitude.trim()
                  ? `Center: ${form.latitude.trim()}, ${form.longitude.trim()}`
                  : "Center: Coordinates"} |{" "}
              {form.allThemes ? "All themes" : form.theme || "Theme"} | {exportPixels} | {form.format.toUpperCase()} |{" "}
              {form.showMarker ? `Pin ${form.markerIcon} ${form.markerColor.toUpperCase()}` : "Pin Off"}
            </p>

            <button type="submit" disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Poster"}
            </button>
            <p className="input-hint">Your generated files will appear in the panel on the right for quick download.</p>
          </fieldset>
        </form>
      </section>

      <section className="results-panel">
        <h2>Generated Files</h2>

        {error ? (
          <div className="generation-error-block">
            <p className="error-copy">{error}</p>
            {errorDetails.length > 0 ? (
              <ul className="error-details">
                {errorDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            {errorTechnical ? (
              <details className="logs">
                <summary>Technical details</summary>
                <pre>{errorTechnical}</pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {outputs.length === 0 && !error ? (
          <p className="quiet">No posters generated yet. Complete steps 1 and 2, then run step 3.</p>
        ) : null}

        <div className="outputs-grid">
          {outputs.map((output) => {
            const isExpanded = expandedOutputIds.has(output.relativePath);

            return (
              <article key={output.relativePath} className="output-card">
                <div className="output-head">
                  <p className="output-title">{output.fileName}</p>
                  <a href={output.downloadUrl} target="_blank" rel="noreferrer">
                    Open / Download
                  </a>
                </div>

                <details
                  className="output-details"
                  open={isExpanded}
                  onToggle={(event) => onOutputDetailsToggle(output.relativePath, event.currentTarget.open)}
                >
                  <summary>{isExpanded ? "Hide preview" : "Show preview"}</summary>
                  <div className="output-preview">
                    {output.previewUrl ? (
                      <img
                        src={output.previewUrl}
                        alt={output.fileName}
                        className="preview-image"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="file-pill">{output.format.toUpperCase()} file</div>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>

        {logs ? (
          <details className="logs">
            <summary>Generator logs</summary>
            <pre>{logs}</pre>
          </details>
        ) : null}
      </section>
    </section>
  );
}
