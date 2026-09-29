import ContentPage from "@/components/ContentPage";

/** About Us - content served by GET api/about-us */
export default function AboutPage() {
  return <ContentPage endpoint="api/about-us" headingFallback="About Us" />;
}
