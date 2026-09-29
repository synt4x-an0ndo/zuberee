import ContentPage from "@/components/ContentPage";

/** Size guide - content served by GET api/pages/size-guide */
export default function SizeGuidePage() {
  return <ContentPage endpoint="api/pages/size-guide" headingFallback="Size Guide" />;
}
