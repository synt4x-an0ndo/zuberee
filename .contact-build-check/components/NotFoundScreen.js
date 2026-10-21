import Link from "next/link";

export default function NotFoundScreen() {
  return (
    <section className="not-found-fullscreen" aria-label="Page not found">
      <div
        className="not-found-art"
        role="img"
        aria-label="404. Page not found. The page you’re looking for doesn’t exist or may have moved."
      />
      <Link href="/" className="not-found-home">
        Back to Homepage
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}