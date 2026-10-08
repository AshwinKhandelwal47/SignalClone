import { Avatar } from "@/components/ui/Avatar";
import type { User } from "@/lib/types";

interface ContactRowProps {
  user: User;
  onClick: () => void;
  subtitle?: string;
  trailing?: React.ReactNode;
}

export function ContactRow({ user, onClick, subtitle, trailing }: ContactRowProps) {
  return (
    <button className="list-row mx-2 w-[calc(100%-16px)]" onClick={onClick}>
      <Avatar name={user.display_name} color={user.avatar_color} url={user.avatar_url} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{user.display_name}</div>
        <div className="truncate text-[13px] text-secondary">
          {subtitle ?? (user.about || (user.username ? `@${user.username}` : user.phone_number))}
        </div>
      </div>
      {trailing}
    </button>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-5 pt-3 pb-1 text-[13px] font-semibold text-secondary">{children}</div>;
}
