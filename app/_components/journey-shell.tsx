import Link from "next/link";
import type { ReactNode } from "react";

import { PlacePrintLogoMark } from "@/app/_components/placeprint-logo-mark";
import { ThemeToggle } from "@/app/_components/theme-toggle";

type JourneyStepId = "themes" | "details" | "generating" | "result";

type JourneyShellProps = {
  currentStep: JourneyStepId;
  children: ReactNode;
};

const STEPS: Array<{ id: JourneyStepId; label: string; href: string }> = [
  { id: "themes", label: "Themes", href: "/" },
  { id: "details", label: "Details", href: "/details" },
  { id: "generating", label: "Generating", href: "/generating" },
  { id: "result", label: "Result", href: "/result" }
];

export function JourneyShell({ currentStep, children }: JourneyShellProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentStepLabel = STEPS[safeCurrentIndex]?.label ?? "Themes";
  const progressPercent = `${Math.round(((safeCurrentIndex + 1) / STEPS.length) * 100)}%`;

  return (
    <div className="journey-shell">
      <header className="journey-header">
        <div className="journey-inner journey-header-row">
          <Link className="journey-brand" href="/">
            <PlacePrintLogoMark className="brand-mark" />
            <span className="brand-text">Place Print</span>
          </Link>

          <nav className="journey-steps" aria-label="Journey steps">
            {STEPS.map((step, index) => {
              const state =
                index < safeCurrentIndex ? "is-complete" : index === safeCurrentIndex ? "is-active" : "is-upcoming";

              return (
                <Link key={step.id} className={`journey-step ${state}`} href={step.href}>
                  <span>{index + 1}</span>
                  <strong>{step.label}</strong>
                </Link>
              );
            })}
          </nav>

          <div className="journey-progress" aria-label="Journey progress">
            <p>
              Step {safeCurrentIndex + 1} of {STEPS.length}: {currentStepLabel}
            </p>
            <div className="journey-progress-track" aria-hidden="true">
              <span style={{ width: progressPercent }} />
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <main className="journey-main">
        <div className="journey-inner">{children}</div>
      </main>

      <footer className="journey-footer">
        <div className="journey-inner">
          <p>Powered by OpenStreetMap data and the Place Print API.</p>
        </div>
      </footer>
    </div>
  );
}
