"use client";

import InfoPage from "@/components/site/InfoPage";
import { useSite } from "@/context/SiteContext";

export default function AboutPage() {
  const { company, siteName } = useSite();
  return (
    <InfoPage eyebrow="Our story" title={`About ${siteName}`} intro="Fashion made for everyday Bangladesh.">
      {company.description ? (
        <div className="rich" style={{ whiteSpace: "pre-line" }}>{company.description}</div>
      ) : null}
    </InfoPage>
  );
}
