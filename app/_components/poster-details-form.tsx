"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { LocationMapPicker } from "@/app/_components/location-map-picker";
import { COUNTRY_OPTIONS } from "@/app/_lib/poster/countries";
import {
  JOURNEY_PAYLOAD_STORAGE_KEY,
  type JourneyPayload
} from "@/app/_lib/poster/journey-storage";
import { getShowcaseSeed } from "@/app/_lib/poster/theme-showcase";
import type { MarkerIcon, MarkerSize } from "@/app/_lib/poster/types";

type ThemeSummary = {
  id: string;
  name: string;
  description: string;
};

type SizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

type CenterMode = "city" | "coordinates" | "map";

type FormState = {
  centerMode: CenterMode;
  theme: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  showMarker: boolean;
  markerColor: string;
  markerIcon: MarkerIcon;
  markerSize: MarkerSize;
  distance: number;
  sizePreset: string;
  width: number;
  height: number;
  format: "png" | "svg" | "pdf";
  displayCity: string;
  displayCountry: string;
};

type GeolocationStatusTone = "info" | "success" | "error";

type GeolocationStatus = {
  tone: GeolocationStatusTone;
  message: string;
};

const CUSTOM_PRESET_ID = "custom";

const SIZE_PRESETS: SizePreset[] = [
  { id: "poster_12x16", label: "Poster 12 x 16 in", width: 12, height: 16 },
  { id: "a4_portrait", label: "A4 portrait", width: 8.27, height: 11.69 },
  { id: "a3_portrait", label: "A3 portrait", width: 11.69, height: 16.54 },
  { id: "instagram_square", label: "Instagram square", width: 3.6, height: 3.6 },
  { id: "story_portrait", label: "Story portrait", width: 3.6, height: 6.4 }
];

const MARKER_ICON_OPTIONS: Array<{ value: MarkerIcon; label: string }> = [
  { value: "dot", label: "Dot" },
  { value: "plus", label: "Plus" },
  { value: "star", label: "Star" },
  { value: "none", label: "None" }
];

const MARKER_SIZE_OPTIONS: Array<{ value: MarkerSize; label: string; note: string }> = [
  { value: "small", label: "Small", note: "Low visual weight" },
  { value: "medium", label: "Medium", note: "Balanced default" },
  { value: "large", label: "Large", note: "High emphasis" }
];

const DEFAULT_FORM: FormState = {
  centerMode: "city",
  theme: "",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
  showMarker: false,
  markerColor: "#d62828",
  markerIcon: "dot",
  markerSize: "medium",
  distance: 18000,
  sizePreset: "a4_portrait",
  width: 8.27,
  height: 11.69,
  format: "png",
  displayCity: "",
  displayCountry: ""
};

function geolocationErrorMessage(code: number): string {
  if (code === 1) {
    return "Location permission was denied. Allow location access or enter coordinates manually.";
  }

  if (code === 2) {
    return "Current location is unavailable right now. Try again or enter coordinates manually.";
  }

  if (code === 3) {
    return "Timed out while requesting location. Try again or enter coordinates manually.";
  }

  return "Could not determine your location. Enter coordinates manually.";
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function matchingPreset(width: number, height: number): SizePreset | undefined {
  return SIZE_PRESETS.find((preset) => nearlyEqual(width, preset.width) && nearlyEqual(height, preset.height));
}

function pxLabel(width: number, height: number): string {
  return `${Math.round(width * 300)} x ${Math.round(height * 300)} px`;
}

function applySeed(themeId: string, previous: FormState): FormState {
  // Keep user-entered location/distance stable when changing theme, like the Python CLI flow.
  return { ...previous, theme: themeId };
}

function isThemeSummary(value: unknown): value is ThemeSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.description === "string"
  );
}

export function PosterDetailsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeolocationSelected, setIsGeolocationSelected] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.id === form.theme),
    [themes, form.theme]
  );
  const selectedSeed = useMemo(() => getShowcaseSeed(form.theme), [form.theme]);
  const isCityCenterMode = form.centerMode === "city";
  const isCoordinateCenterMode = form.centerMode === "coordinates";
  const isMapCenterMode = form.centerMode === "map";
  const usesCoordinateCenter = !isCityCenterMode;
  const cityValue = form.city.trim();
  const countryValue = form.country.trim();
  const latitudeValue = form.latitude.trim();
  const longitudeValue = form.longitude.trim();
  const hasCity = cityValue.length > 0;
  const hasCountry = countryValue.length > 0;
  const hasTheme = form.theme.length > 0 && themes.some((theme) => theme.id === form.theme);
  const hasCoordinatePair = latitudeValue.length > 0 && longitudeValue.length > 0;
  const missingRequirements: string[] = [];

  if (isCityCenterMode) {
    if (!hasCity) {
      missingRequirements.push("add a city");
    }
    if (!hasCountry) {
      missingRequirements.push("add a country");
    }
  } else if (!hasCoordinatePair) {
    missingRequirements.push(isMapCenterMode ? "pick or enter both latitude and longitude" : "enter both latitude and longitude");
  }

  if (!hasTheme) {
    missingRequirements.push("select a theme");
  }

  const canContinue = missingRequirements.length === 0;

  useEffect(() => {
    const selectedThemeFromQuery = searchParams.get("theme")?.trim() || "";

    const loadThemes = async () => {
      setError(null);
      try {
        const response = await fetch("/api/themes", { cache: "no-store" });
        const data = (await response.json()) as { themes?: unknown; error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Failed to load themes.");
        }

        const parsedThemes = Array.isArray(data.themes) ? data.themes.filter(isThemeSummary) : [];
        setThemes(parsedThemes);

        const requestedTheme = parsedThemes.find((theme) => theme.id === selectedThemeFromQuery)?.id;
        const fallbackTheme = parsedThemes[0]?.id ?? "";
        const resolvedTheme = requestedTheme || fallbackTheme;

        if (!resolvedTheme) {
          setForm((previous) => ({ ...previous, theme: "" }));
          setError("No themes are currently available. Please try again later.");
          return;
        }

        setForm((previous) => applySeed(resolvedTheme, previous));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load themes.");
      }
    };

    void loadThemes();
  }, [searchParams]);

  const onCenterModeChange = (mode: CenterMode) => {
    setError(null);
    setIsGeolocationSelected(false);
    setGeolocationStatus(null);
    setForm((previous) => {
      if (mode === "city") {
        return { ...previous, centerMode: "city", latitude: "", longitude: "" };
      }

      if (mode === "coordinates") {
        return { ...previous, centerMode: "coordinates", city: "", country: "" };
      }

      return { ...previous, centerMode: "map", city: "", country: "" };
    });
  };

  const onSizePresetChange = (presetId: string) => {
    setForm((previous) => {
      if (presetId === CUSTOM_PRESET_ID) {
        return { ...previous, sizePreset: CUSTOM_PRESET_ID };
      }

      const preset = SIZE_PRESETS.find((item) => item.id === presetId);
      if (!preset) {
        return previous;
      }

      return { ...previous, sizePreset: preset.id, width: preset.width, height: preset.height };
    });
  };

  const onThemeChange = (themeId: string) => {
    setIsGeolocationSelected(false);
    setForm((previous) => applySeed(themeId, previous));
  };

  const onMapCoordinatesChange = useCallback((latitude: string, longitude: string) => {
    setIsGeolocationSelected(false);
    setForm((previous) => ({
      ...previous,
      centerMode: "map",
      city: "",
      country: "",
      latitude,
      longitude
    }));
  }, []);

  const onUseCurrentLocation = () => {
    setError(null);
    setGeolocationStatus(null);

    if (isCityCenterMode) {
      setGeolocationStatus({
        tone: "info",
        message: "Switch to coordinates or map mode to use your current location."
      });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeolocationStatus({
        tone: "error",
        message: "HTML5 geolocation is not available in this browser. Enter latitude and longitude manually."
      });
      return;
    }

    setIsLocating(true);
    setGeolocationStatus({ tone: "info", message: "Requesting your current location..." });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);

        setForm((previous) => ({
          ...previous,
          centerMode: previous.centerMode === "map" ? "map" : "coordinates",
          city: "",
          country: "",
          latitude,
          longitude
        }));
        setIsGeolocationSelected(true);
        setGeolocationStatus({
          tone: "success",
          message:
            form.centerMode === "map"
              ? "Current coordinates added. Fine-tune them in the map picker."
              : "Current coordinates added. Center mode switched to coordinates."
        });
        setIsLocating(false);
      },
      (geoError) => {
        setIsGeolocationSelected(false);
        setGeolocationStatus({
          tone: "error",
          message: geolocationErrorMessage(geoError.code)
        });
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!hasTheme) {
      setError("Theme is required.");
      return;
    }

    if (isCityCenterMode && (!hasCity || !hasCountry)) {
      setError("City and country are required when using city center mode.");
      return;
    }

    if (!isCityCenterMode && !hasCoordinatePair) {
      setError("Latitude and longitude are required when using coordinate or map center mode.");
      return;
    }

    const payload: JourneyPayload = {
      city: isCityCenterMode ? cityValue : "",
      country: isCityCenterMode ? countryValue : "",
      latitude: isCityCenterMode ? undefined : latitudeValue || undefined,
      longitude: isCityCenterMode ? undefined : longitudeValue || undefined,
      showMarker: form.showMarker,
      markerColor: form.markerColor,
      markerIcon: form.markerIcon,
      markerSize: form.markerSize,
      theme: form.theme,
      distance: Math.max(100, Math.round(form.distance || 18000)),
      width: Math.min(20, Math.max(1, form.width)),
      height: Math.min(20, Math.max(1, form.height)),
      format: form.format,
      displayCity: form.displayCity.trim() || undefined,
      displayCountry: form.displayCountry.trim() || undefined
    };

    setIsSubmitting(true);

    try {
      sessionStorage.setItem(JOURNEY_PAYLOAD_STORAGE_KEY, JSON.stringify(payload));
      router.push("/generating");
    } catch {
      setError("Could not save generation details in this browser session.");
      setIsSubmitting(false);
    }
  };

  return (
    <section className="details-shell" aria-label="Poster details step">
      <header className="section-header">
        <p className="eyebrow">Step 2</p>
        <h1>Set your location</h1>
        <p>Theme and location are required. Open optional settings only if you want fine control.</p>
      </header>

      <form className="details-form" onSubmit={onSubmit}>
        <section className="details-section" aria-labelledby="details-location-title">
          <div className="details-section-header">
            <h2 id="details-location-title">Required details</h2>
            <p>Choose a theme, then set map center by city, coordinates, or map picker.</p>
          </div>

          <div>
            <div className="details-grid">
              <label className="details-grid-full">
                Theme
                <select
                  value={form.theme}
                  onChange={(event) => onThemeChange(event.target.value)}
                  required
                  disabled={themes.length === 0}
                >
                  <option value="" disabled>
                    {themes.length > 0 ? "Select a theme" : "No themes available"}
                  </option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
                {selectedTheme?.description ? <span className="input-hint">{selectedTheme.description}</span> : null}
                {themes.length === 0 ? (
                  <span className="input-hint">Theme options are unavailable right now. Refresh to retry.</span>
                ) : null}
              </label>

              <div className="details-grid-full center-mode-group" role="radiogroup" aria-label="Map center mode">
                <p className="center-mode-title">Center mode (choose one)</p>
                <div className="center-mode-options">
                  <label className={`center-mode-option${isCityCenterMode ? " is-active" : ""}`}>
                    <input
                      type="radio"
                      name="center-mode-required"
                      checked={isCityCenterMode}
                      onChange={() => onCenterModeChange("city")}
                    />
                    <span className="center-mode-option-copy">
                      <strong>City + country</strong>
                      <span>Use place names to geocode the map center.</span>
                    </span>
                  </label>
                  <label className={`center-mode-option${isCoordinateCenterMode ? " is-active" : ""}`}>
                    <input
                      type="radio"
                      name="center-mode-required"
                      checked={isCoordinateCenterMode}
                      onChange={() => onCenterModeChange("coordinates")}
                    />
                    <span className="center-mode-option-copy">
                      <strong>Coordinates</strong>
                      <span>Use exact latitude and longitude values.</span>
                    </span>
                  </label>
                  <label className={`center-mode-option${isMapCenterMode ? " is-active" : ""}`}>
                    <input
                      type="radio"
                      name="center-mode-required"
                      checked={isMapCenterMode}
                      onChange={() => onCenterModeChange("map")}
                    />
                    <span className="center-mode-option-copy">
                      <strong>Pick on map</strong>
                      <span>Select an exact center directly in OpenStreetMap.</span>
                    </span>
                  </label>
                </div>
              </div>

              {usesCoordinateCenter ? (
                <div className="details-grid-full geolocation-panel">
                  <button
                    type="button"
                    className="ghost-button geolocation-trigger"
                    onClick={onUseCurrentLocation}
                    disabled={isLocating}
                  >
                    {isLocating ? "Getting current location..." : "Use current location"}
                  </button>
                  <p className="input-hint">Gets your current latitude and longitude.</p>
                  {geolocationStatus ? (
                    <p className={`geolocation-status is-${geolocationStatus.tone}`} role="status" aria-live="polite">
                      {geolocationStatus.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isGeolocationSelected ? (
                <p className="details-grid-full helper-note">
                  Geolocation is active. {isMapCenterMode ? "Map mode is ready for fine-tuning." : "Coordinates mode is selected."}
                </p>
              ) : null}

              {isCityCenterMode ? (
                <>
                  <label>
                    City
                    <input
                      value={form.city}
                      onChange={(event) => {
                        const nextCity = event.target.value;
                        setIsGeolocationSelected(false);
                        setForm((previous) => ({ ...previous, city: nextCity, latitude: "", longitude: "" }));
                      }}
                      placeholder="Paris"
                      required
                    />
                  </label>

                  <label>
                    Country
                    <input
                      list="country-options"
                      value={form.country}
                      onChange={(event) => {
                        const nextCountry = event.target.value;
                        setIsGeolocationSelected(false);
                        setForm((previous) => ({ ...previous, country: nextCountry, latitude: "", longitude: "" }));
                      }}
                      placeholder="France"
                      required
                    />
                    <datalist id="country-options">
                      {COUNTRY_OPTIONS.map((countryName) => (
                        <option key={countryName} value={countryName} />
                      ))}
                    </datalist>
                  </label>
                </>
              ) : isCoordinateCenterMode ? (
                <>
                  <label>
                    Latitude
                    <input
                      value={form.latitude}
                      onChange={(event) => {
                        setIsGeolocationSelected(false);
                        setForm((previous) => ({ ...previous, latitude: event.target.value, city: "", country: "" }));
                      }}
                      placeholder="48.8566"
                      inputMode="decimal"
                      required
                    />
                  </label>

                  <label>
                    Longitude
                    <input
                      value={form.longitude}
                      onChange={(event) => {
                        setIsGeolocationSelected(false);
                        setForm((previous) => ({ ...previous, longitude: event.target.value, city: "", country: "" }));
                      }}
                      placeholder="2.3522"
                      inputMode="decimal"
                      required
                    />
                  </label>

                  <p className="details-grid-full input-hint">
                    Coordinates mode requires both latitude and longitude.
                  </p>
                </>
              ) : (
                <>
                  <div className="details-grid-full map-picker-panel">
                    <p className="center-mode-title">OpenStreetMap picker</p>
                    <p className="input-hint">Click or tap the map to set the center, then drag the pin to refine it.</p>
                    <LocationMapPicker
                      latitude={form.latitude}
                      longitude={form.longitude}
                      distanceMeters={form.distance}
                      posterWidthInches={form.width}
                      posterHeightInches={form.height}
                      onCoordinatesChange={onMapCoordinatesChange}
                      onDistanceChange={(nextDistance) =>
                        setForm((previous) => ({
                          ...previous,
                          distance: Math.max(100, Math.round(nextDistance))
                        }))
                      }
                      isVisible={isMapCenterMode}
                    />
                  </div>

                  <label>
                    Latitude
                    <input
                      value={form.latitude}
                      onChange={(event) => {
                        setIsGeolocationSelected(false);
                        setForm((previous) => ({
                          ...previous,
                          centerMode: "map",
                          latitude: event.target.value,
                          city: "",
                          country: ""
                        }));
                      }}
                      placeholder="48.8566"
                      inputMode="decimal"
                      required
                    />
                  </label>

                  <label>
                    Longitude
                    <input
                      value={form.longitude}
                      onChange={(event) => {
                        setIsGeolocationSelected(false);
                        setForm((previous) => ({
                          ...previous,
                          centerMode: "map",
                          longitude: event.target.value,
                          city: "",
                          country: ""
                        }));
                      }}
                      placeholder="2.3522"
                      inputMode="decimal"
                      required
                    />
                  </label>

                  <p className="details-grid-full input-hint">
                    Map mode requires both latitude and longitude, and keeps them synced with your map pin.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <details className="details-optional">
          <summary>Optional customizations</summary>

          <div className="details-optional-body">
            <div className="details-grid">
              <label className="checkbox-row details-grid-full">
                <input
                  type="checkbox"
                  checked={form.showMarker}
                  onChange={(event) => setForm((previous) => ({ ...previous, showMarker: event.target.checked }))}
                />
                Add center pinpoint marker
                <span className="input-hint">
                  Places a marker at the exact map center used for geocoding (or your latitude/longitude override).
                </span>
              </label>

              {form.showMarker ? (
                <>
                  <label>
                    Marker Color
                    <input
                      type="color"
                      value={form.markerColor}
                      onChange={(event) => setForm((previous) => ({ ...previous, markerColor: event.target.value }))}
                      aria-label="Marker color"
                    />
                    <span className="input-hint">{form.markerColor.toUpperCase()}</span>
                  </label>

                  <label>
                    Marker Icon
                    <select
                      value={form.markerIcon}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, markerIcon: event.target.value as MarkerIcon }))
                      }
                    >
                      {MARKER_ICON_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <fieldset className="details-grid-full marker-size-group">
                    <legend>Marker Size</legend>
                    <div className="marker-size-options" role="radiogroup" aria-label="Marker size">
                      {MARKER_SIZE_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={`marker-size-option${form.markerSize === option.value ? " is-active" : ""}`}
                        >
                          <input
                            type="radio"
                            name="marker-size-details"
                            value={option.value}
                            checked={form.markerSize === option.value}
                            onChange={(event) =>
                              setForm((previous) => ({
                                ...previous,
                                markerSize: event.target.value as MarkerSize
                              }))
                            }
                          />
                          <span className="marker-size-option-copy">
                            <strong>{option.label}</strong>
                            <span>{option.note}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : null}

              <label>
                Size Preset
                <select value={form.sizePreset} onChange={(event) => onSizePresetChange(event.target.value)}>
                  {SIZE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label} ({pxLabel(preset.width, preset.height)})
                    </option>
                  ))}
                  <option value={CUSTOM_PRESET_ID}>Custom</option>
                </select>
              </label>

              <label>
                Output Format
                <select
                  value={form.format}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      format: event.target.value as FormState["format"]
                    }))
                  }
                >
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>

              <label>
                Width (inches)
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={0.01}
                  value={form.width}
                  onChange={(event) => {
                    const width = Number(event.target.value) || 1;
                    setForm((previous) => ({
                      ...previous,
                      width,
                      sizePreset: matchingPreset(width, previous.height)?.id ?? CUSTOM_PRESET_ID
                    }));
                  }}
                />
              </label>

              <label>
                Height (inches)
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={0.01}
                  value={form.height}
                  onChange={(event) => {
                    const height = Number(event.target.value) || 1;
                    setForm((previous) => ({
                      ...previous,
                      height,
                      sizePreset: matchingPreset(previous.width, height)?.id ?? CUSTOM_PRESET_ID
                    }));
                  }}
                />
              </label>

              <label>
                Title (optional)
                <input
                  value={form.displayCity}
                  onChange={(event) => setForm((previous) => ({ ...previous, displayCity: event.target.value }))}
                  placeholder="Poster title"
                />
              </label>

              <label>
                Subtitle (optional)
                <input
                  value={form.displayCountry}
                  onChange={(event) => setForm((previous) => ({ ...previous, displayCountry: event.target.value }))}
                  placeholder="Poster subtitle"
                />
              </label>
            </div>

            {selectedSeed ? (
              <p className="helper-note">
                Suggested map profile: <strong>{selectedSeed.note}</strong>
              </p>
            ) : null}
          </div>
        </details>

        <p className="summary-banner">
          {isCityCenterMode
            ? `${form.city || "City"}, ${form.country || "Country"}`
            : latitudeValue && longitudeValue
              ? `Center: ${latitudeValue}, ${longitudeValue}`
              : isMapCenterMode
                ? "Center: Pick on map"
                : "Center: Coordinates"} | {form.theme || "Theme"} | {pxLabel(form.width, form.height)} |{" "}
          {form.format.toUpperCase()} |{" "}
          {form.showMarker ? `Pin ${form.markerIcon} ${form.markerColor.toUpperCase()}` : "Pin Off"}
          {form.showMarker ? ` (${form.markerSize})` : ""}
        </p>

        {error ? <p className="error-copy">{error}</p> : null}

        <div className="details-actions">
          <button type="submit" disabled={isSubmitting || !canContinue}>
            Continue to Generating
          </button>
        </div>
        <p className={`details-submit-hint${canContinue ? " is-ready" : ""}`}>
          {canContinue ? "Ready to generate." : `Before continuing: ${missingRequirements.join(", ")}.`}
        </p>
      </form>
    </section>
  );
}
