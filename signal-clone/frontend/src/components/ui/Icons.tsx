// Outline icons drawn in the style of Signal Desktop (20px grid, 1.5px strokes).
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5c-4.97 0-9 3.58-9 8 0 2.03.85 3.88 2.25 5.29L4.5 20.5l4.1-1.37c1.05.4 2.2.62 3.4.62 4.97 0 9-3.58 9-8s-4.03-8.25-9-8.25Z" />
  </Icon>
);

export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.6 3.5h-2a1.5 1.5 0 0 0-1.5 1.6C3.6 13.4 10.6 20.4 18.9 20.9a1.5 1.5 0 0 0 1.6-1.5v-2a1.5 1.5 0 0 0-1.2-1.5l-3-.6a1.5 1.5 0 0 0-1.4.4l-1.3 1.3a12 12 0 0 1-5.6-5.6l1.3-1.3a1.5 1.5 0 0 0 .4-1.4l-.6-3A1.5 1.5 0 0 0 6.6 3.5Z" />
  </Icon>
);

export const VideoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.75" y="6" width="13" height="12" rx="2.5" />
    <path d="m15.75 10.5 5.5-3.25v9.5l-5.5-3.25" />
  </Icon>
);

export const StoriesIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.2" />
    <circle cx="12" cy="12" r="4.5" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Icon>
);

export const ComposeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V13" />
    <path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7L12 14.9l-3.5.9.9-3.5 8.2-8.4Z" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.25" />
    <path d="m15.25 15.25 5 5" />
  </Icon>
);

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5 8 12l7 7" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1" fill="currentColor" />
  </Icon>
);

export const GroupIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3.5 19c.5-3 2.8-5 5.5-5s5 2 5.5 5" />
    <circle cx="16.5" cy="9" r="2.5" />
    <path d="M16 14c2.3 0 4.1 1.6 4.5 4" />
  </Icon>
);

export const PersonIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.5 20c.7-3.6 3.8-6 7.5-6s6.8 2.4 7.5 6" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <path d="M4.4 3.6a.9.9 0 0 0-1.2 1.1L5.6 12l-2.4 7.3a.9.9 0 0 0 1.2 1.1l16.3-7.6a.9.9 0 0 0 0-1.6L4.4 3.6Zm2.6 9.15h6.25a.75.75 0 0 0 0-1.5H7l-1.6-4.8L18 12 5.4 17.55 7 12.75Z" />
  </Icon>
);

export const EmojiIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14.5c.8 1.2 2 1.9 3.5 1.9s2.7-.7 3.5-1.9" />
    <circle cx="9" cy="10" r=".75" fill="currentColor" />
    <circle cx="15" cy="10" r=".75" fill="currentColor" />
  </Icon>
);

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);

export const PaletteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.75-.9 1.4-1.9-.4-1.1.3-2.1 1.5-2.1h2.1a3.5 3.5 0 0 0 3.5-3.5c0-5.2-3.8-9.5-8.5-9.5Z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
    <circle cx="15" cy="8" r="1" fill="currentColor" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6l-7-2.5Z" />
  </Icon>
);

export const DevicesIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="13" height="10" rx="1.5" />
    <path d="M6 19h7M9.5 15v4" />
    <rect x="17.5" y="9" width="4" height="10" rx="1" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.5" />
    <circle cx="12" cy="16.25" r=".75" fill="currentColor" />
  </Icon>
);

export const FilterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6.5h16M7 12h10M10 17.5h4" />
  </Icon>
);

/** Signal-style logo mark: a speech bubble ringed by a dashed circle. */
export function SignalLogo({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="21"
        fill="none"
        stroke="var(--ultramarine)"
        strokeWidth="2.5"
        strokeDasharray="5 3"
      />
      <path
        d="M24 11c-7.2 0-13 5.2-13 11.6 0 3 1.3 5.8 3.4 7.8L13 36.5l6.3-1.9c1.4.5 3 .8 4.7.8 7.2 0 13-5.2 13-11.7S31.2 11 24 11Z"
        fill="var(--ultramarine)"
      />
    </svg>
  );
}
