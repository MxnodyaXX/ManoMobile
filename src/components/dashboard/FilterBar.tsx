"use client";

const filters = ["Daily", "Weekly", "Monthly", "Yearly", "All"];

export default function FilterBar({
  active,
  onChange,
}: {
  active: string;
  onChange: (filter: string) => void;
}) {
  return (
    <div
      className="fade-up fade-up-1"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        width: "fit-content",
      }}
    >
      {filters.map((f) => {
        const isActive = active === f;
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              fontFamily: isActive ? "'Syne', sans-serif" : "'DM Sans', sans-serif",
              background: isActive ? "var(--accent)" : "transparent",
              color: isActive ? "#0a0a0f" : "var(--text-secondary)",
              transition: "all 0.18s ease",
              outline: "none",
              letterSpacing: isActive ? "-0.01em" : "0",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              }
            }}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
}