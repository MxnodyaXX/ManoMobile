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
        gap: 4,
        padding: "4px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        width: "fit-content",
        boxShadow: "var(--shadow-card)",
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
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              background: isActive ? "var(--accent)" : "transparent",
              color: isActive ? "#ffffff" : "var(--text-secondary)",
              transition: "all 0.18s ease",
              outline: "none",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-dim)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
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