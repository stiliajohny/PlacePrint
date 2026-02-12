import { JourneyShell } from "@/app/_components/journey-shell";
import { ThemeShowcase } from "@/app/_components/theme-showcase";

export default function HomePage() {
  return (
    <JourneyShell currentStep="themes">
      <ThemeShowcase />
    </JourneyShell>
  );
}
