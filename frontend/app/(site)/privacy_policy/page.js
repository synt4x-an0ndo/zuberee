import ContentPage from "@/components/ContentPage";

/** Privacy Policy - content served by GET api/pages/privacy-policy */
export default function PrivacyPage() {
  return (
    <ContentPage
      endpoint="api/pages/privacy-policy"
      headingFallback="Privacy Policy"
    />
  );
}
