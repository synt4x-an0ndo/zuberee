"use client";

import Img from "@/components/Img";
import SafeHtml from "@/components/SafeHtml";
import InfoPage from "@/components/site/InfoPage";
import { Skeleton } from "@/components/ui";
import { useSite } from "@/context/SiteContext";
import { api, imgUrl } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

/**
 * GET /api/about-us (public) -> { id, title, content, image, created_at, updated_at }
 * 404 { message: "About us not configured yet." } until the admin creates it, in which case
 * the page falls back to the footer company description.
 */
export default function AboutPage() {
  const { company, siteName } = useSite();
  const { data, loading } = useAsync(async () => {
    return api.get("api/about-us", { auth: false }).catch((err) => (err.status === 404 ? null : Promise.reject(err)));
  }, []);

  const image = imgUrl(data?.image);

  return (
    <InfoPage eyebrow="Our story" title={data?.title || `About ${siteName}`} intro="Fashion made for everyday Bangladesh.">
      {loading ? (
        <div className="stack">
          <Skeleton style={{ height: 240 }} />
          <Skeleton style={{ height: 90 }} />
        </div>
      ) : (
        <div className="stack" style={{ gap: "1.5rem" }}>
          {image ? (
            <Img src={image} alt={data?.title || "About us"} width={820} height={420} style={{ width: "100%", height: "auto", borderRadius: 16, border: "1px solid var(--line)" }} />
          ) : null}
          {data?.content ? (
            <SafeHtml html={data.content} />
          ) : company.description ? (
            <div className="rich" style={{ whiteSpace: "pre-line" }}>{company.description}</div>
          ) : null}
        </div>
      )}
    </InfoPage>
  );
}
