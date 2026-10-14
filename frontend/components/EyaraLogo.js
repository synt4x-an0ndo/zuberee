/** Inline Eyara Fashion wordmark: bag mark, serif name, spaced "FASHION". Uses currentColor. */
export default function EyaraLogo({ height = 56, className = "" }) {
  return (
    <svg className={className} height={height} viewBox="0 0 260 90" role="img" aria-label="Eyara Fashion" style={{ display: "block", width: "auto" }}>
      <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 34h44l-3 42H15z" />
        <path d="M24 34v-6a12 12 0 0 1 24 0v6" />
      </g>
      <text x="74" y="50" fill="currentColor" style={{ font: "600 38px Georgia, 'Times New Roman', serif", letterSpacing: "0.5px" }}>EYARA</text>
      <text x="80" y="76" fill="currentColor" style={{ font: "500 17px Arial, Helvetica, sans-serif", letterSpacing: "8px" }}>FASHION</text>
    </svg>
  );
}
