import { BackIcon } from "@/components/ui/Icons";

interface PaneHeaderProps {
  title: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function PaneHeader({ title, onBack, actions }: PaneHeaderProps) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
      {onBack && (
        <button className="icon-button -ml-2" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
      )}
      <h1 className="flex-1 truncate text-[17px] font-semibold">{title}</h1>
      {actions}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  id,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative mx-4 mb-2">
      <svg
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-tertiary"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="10.5" cy="10.5" r="6.25" />
        <path d="m15.25 15.25 5 5" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        className="w-full rounded-lg bg-input py-1.5 pr-8 pl-8 text-[14px] text-primary outline-none placeholder:text-tertiary focus:ring-1 focus:ring-ultramarine"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        autoFocus={autoFocus}
      />
      {value && (
        <button
          className="absolute top-1/2 right-2 -translate-y-1/2 text-tertiary hover:text-primary"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
