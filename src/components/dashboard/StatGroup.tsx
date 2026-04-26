export default function StatGroup({
  children,
  index = 0,
  title,
  dateLabel,
}: {
  children: React.ReactNode;
  index?: number;
  title?: string;
  dateLabel?: string;
}) {
  return (
    <div
      className={`fade-up fade-up-${index + 1}`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-active)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
      }}
    >
      {/* Group heading + date label */}
      {(title || dateLabel) && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 10,
          borderBottom: "1px solid var(--border)",
        }}>
          {title && (
            <p className="heading" style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              letterSpacing: "0.02em",
            }}>
              {title}
            </p>
          )}
          {dateLabel && (
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--accent)",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-glow)",
              padding: "3px 10px",
              borderRadius: 100,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}>
              {dateLabel}
            </span>
          )}
        </div>
      )}

      {children}
    </div>
  );
}