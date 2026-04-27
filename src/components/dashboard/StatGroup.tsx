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
        borderRadius: 16,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: "var(--shadow-card)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-active)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
      }}
    >
      {(title || dateLabel) && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}>
          {title && (
            <p className="heading" style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}>
              {title}
            </p>
          )}
          {dateLabel && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--accent)",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-glow)",
              padding: "3px 10px",
              borderRadius: 100,
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