import Link from "next/link";
import Img from "@/components/Img";
import { useSite } from "@/context/SiteContext";

export default function AuthCard({ eyebrow, title, subtitle, children, footer }) {
  const { siteName, company } = useSite();
  const name = siteName || "Store";
  return (
    <div className="auth-wrap anim-fade-up">
      <div className="auth-card">
        <Link href="/" className="auth-brand" aria-label={`${name} home`}>
          {company.logo ? <Img src={company.logo} alt={name} width={180} height={44} priority /> : (
            <>
              <span className="brand-mark" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
              <span className="brand-name">{name}</span>
            </>
          )}
        </Link>
        {eyebrow && <p className="eyebrow" style={{ textAlign: "center" }}>{eyebrow}</p>}
        <h1 style={{ textAlign: "center", fontSize: "1.6rem" }}>{title}</h1>
        {subtitle && <p className="muted" style={{ textAlign: "center", marginTop: 6 }}>{subtitle}</p>}
        <div className="stack" style={{ marginTop: "1.5rem" }}>{children}</div>
        {footer && <div className="auth-foot">{footer}</div>}
      </div>
    </div>
  );
}
