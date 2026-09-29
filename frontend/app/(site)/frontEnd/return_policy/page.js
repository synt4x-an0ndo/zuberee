import ContentPage from "@/components/ContentPage";

/** Return policy - content served by GET api/pages/return-policy */
export default function ReturnPolicyPage() {
  return (
    <ContentPage
      endpoint="api/pages/return-policy"
      headingFallback="Returns & Exchanges"
    />
  );
}
