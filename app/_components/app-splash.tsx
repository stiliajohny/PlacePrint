"use client";

import { useEffect, useState } from "react";

import { PlacePrintLogoMark } from "@/app/_components/placeprint-logo-mark";

const SPLASH_HOLD_MS = 520;
const SPLASH_FADE_MS = 360;

export function AppSplash() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(false);
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setIsFading(true);
    }, SPLASH_HOLD_MS);

    const hideTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, SPLASH_HOLD_MS + SPLASH_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`app-splash${isFading ? " is-fading" : ""}`} aria-hidden="true">
      <div className="app-splash-content">
        <PlacePrintLogoMark className="app-splash-mark" />
        <p className="app-splash-title">Place Print</p>
      </div>
    </div>
  );
}
