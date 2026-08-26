// Cars24 brand mark + wordmark, used on the login hero and the app sidebar.
export function Cars24Mark({ size = 34 }) {
  return (
    <span
      className="brand-mark"
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      aria-hidden="true"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 32 32">
        {/* Rounded "C" swoosh with a forward arrow — echoes the Cars24 mark */}
        <path
          d="M23.5 9.5A10 10 0 1 0 23.5 22.5"
          fill="none" stroke="var(--brand)" strokeWidth="4.2" strokeLinecap="round"
        />
        <path d="M15 12l5 4-5 4" fill="none" stroke="var(--brand)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Cars24Wordmark({ size = 22, color = '#fff' }) {
  return (
    <span className="brand-word" style={{ fontSize: size, color }}>
      Cars<span style={{ color }}>24</span>
    </span>
  );
}
