import { Suspense } from "react";

import { JourneyShell } from "@/app/_components/journey-shell";
import { PosterDetailsForm } from "@/app/_components/poster-details-form";

export default function DetailsPage() {
  return (
    <JourneyShell currentStep="details">
      <Suspense fallback={null}>
        <PosterDetailsForm />
      </Suspense>
    </JourneyShell>
  );
}
