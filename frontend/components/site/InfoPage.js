"use client";

import { FiMail, FiPhone, FiMapPin } from "react-icons/fi";
import { useSite } from "@/context/SiteContext";
import { Button, EmptyState, PageHeader } from "@/components/ui";

/**
 * Static information pages. Copy comes from the store owner: if company_description is set
 * in the backend footer settings it is shown, otherwise a short contact-first message.
 */
export default function InfoPage({ eyebrow, title, intro, children }) {
  const { company, siteName } = useSite();
  const hasContact = company.email || company.phone || company.address;
  return (
    <div className="container section anim-fade-up" style={{ maxWidth: 820 }}>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={intro} />
      {children || (
        <EmptyState
          title="Details are on their way"
          text={`The full ${title.toLowerCase()} for ${siteName} is being finalised. Until then, our team is happy to help.`}
          action={hasContact ? undefined : <Button href="/shop" variant="primary">Back to shop</Button>}
        />
      )}
      {hasContact && (
        <div className="card card-pad" style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Contact us</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, color: "var(--ink-2)" }}>
            {company.phone && <li><FiPhone aria-hidden="true" /> <a href={`tel:${company.phone}`}>{company.phone}</a></li>}
            {company.email && <li><FiMail aria-hidden="true" /> <a href={`mailto:${company.email}`}>{company.email}</a></li>}
            {company.address && <li><FiMapPin aria-hidden="true" /> {company.address}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
