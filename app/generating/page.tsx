import { JourneyShell } from "@/app/_components/journey-shell";
import { PosterGenerating } from "@/app/_components/poster-generating";

export default function GeneratingPage() {
  return (
    <JourneyShell currentStep="generating">
      <PosterGenerating />
    </JourneyShell>
  );
}

