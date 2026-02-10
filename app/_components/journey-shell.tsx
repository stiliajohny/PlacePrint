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
                index < currentIndex ? "is-complete" : index === currentIndex ? "is-active" : "is-upcoming";

              return (
                <Link key={step.id} className={`journey-step ${state}`} href={step.href}>
                  <span>{index + 1}</span>
                  <strong>{step.label}</strong>
                </Link>
              );
            })}
          </nav>

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
