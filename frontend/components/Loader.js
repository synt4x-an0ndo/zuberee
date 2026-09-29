"use client";

/** Spinner matching the original loader-icon style. */
export default function Loader({ text }) {
  return (
    <div className="container py-5" aria-label="Loading content" role="status">
      <div className="placeholder-skeleton" aria-hidden="true">
        <div className="placeholder-skeleton__bar placeholder-skeleton__bar--title" />
        <div className="placeholder-skeleton__bar placeholder-skeleton__bar--wide" />
        <div className="placeholder-skeleton__grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="placeholder-skeleton__card" key={index}>
              <div className="placeholder-skeleton__image" />
              <div className="placeholder-skeleton__bar" />
              <div className="placeholder-skeleton__bar placeholder-skeleton__bar--short" />
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .placeholder-skeleton { max-width: 1200px; margin: 0 auto; }
        .placeholder-skeleton__bar,
        .placeholder-skeleton__image,
        .placeholder-skeleton__card { background: #edf0f2; }
        .placeholder-skeleton__bar,
        .placeholder-skeleton__image { border-radius: 4px; }
        .placeholder-skeleton__bar { height: 14px; width: 62%; margin-bottom: 12px; }
        .placeholder-skeleton__bar--title { height: 24px; width: 28%; margin-bottom: 28px; }
        .placeholder-skeleton__bar--wide { width: 100%; margin-bottom: 28px; }
        .placeholder-skeleton__bar--short { width: 42%; margin-bottom: 0; }
        .placeholder-skeleton__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .placeholder-skeleton__card { padding: 12px; border-radius: 4px; }
        .placeholder-skeleton__image { aspect-ratio: 1; width: 100%; margin-bottom: 16px; }
        .placeholder-skeleton__bar,
        .placeholder-skeleton__image,
        .placeholder-skeleton__card { animation: placeholder-pulse 1.5s ease-in-out infinite; }
        @keyframes placeholder-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
        @media (max-width: 767px) {
          .placeholder-skeleton__grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
