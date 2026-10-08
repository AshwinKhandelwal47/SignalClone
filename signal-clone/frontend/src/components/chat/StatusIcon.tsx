import type { MessageStatus } from "@/lib/types";

interface StatusIconProps {
  status: MessageStatus | null;
  /** Colour of the check inside filled ("read") circles: the surface behind the icon. */
  cutoutColor?: string;
  className?: string;
}

// Left circle with a gap where the right circle overlaps it (see ARCHITECTURE.md §7.2).
const LEFT_ARC = "M8.08 1.45A5 5 0 1 0 8.08 10.55";
const LEFT_CRESCENT = `${LEFT_ARC}A6 6 0 0 1 8.08 1.45Z`;

/** Signal's message status marks: sending ◌, sent ✓, delivered ✓✓, read ●● (filled). */
export function StatusIcon({ status, cutoutColor = "var(--bg-left-pane)", className = "" }: StatusIconProps) {
  if (!status || status === "failed") return null;
  const label = { sending: "Sending", sent: "Sent", delivered: "Delivered", read: "Read" }[status];

  if (status === "sending") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className={className} aria-label={label} role="img">
        <circle
          cx="6"
          cy="6"
          r="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="2 1.6"
        />
      </svg>
    );
  }
  if (status === "sent") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className={className} aria-label={label} role="img">
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M3.6 6.2l1.6 1.6 3.2-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const filled = status === "read";
  const checkColor = filled ? cutoutColor : "currentColor";
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" className={className} aria-label={label} role="img">
      {filled ? (
        <>
          <path d={LEFT_CRESCENT} fill="currentColor" />
          <circle cx="12" cy="6" r="5" fill="currentColor" />
        </>
      ) : (
        <>
          <path d={LEFT_ARC} fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
      <path
        d="M3.4 6.2l1.5 1.5 2.4-2.7"
        fill="none"
        stroke={checkColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 6.2l1.6 1.6 3.2-3.5"
        fill="none"
        stroke={checkColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
