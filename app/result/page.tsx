import { JourneyShell } from "@/app/_components/journey-shell";
import { PosterResult } from "@/app/_components/poster-result";

export default function ResultPage() {
  return (
    <JourneyShell currentStep="result">
      <PosterResult />
    </JourneyShell>
  );
}

