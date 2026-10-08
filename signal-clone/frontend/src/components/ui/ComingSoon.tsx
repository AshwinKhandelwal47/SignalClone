interface ComingSoonProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
}

export function ComingSoon({ icon, title, description }: ComingSoonProps) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 bg-chat p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-hover text-secondary">
        {icon}
      </div>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="max-w-xs text-secondary">{description ?? "Coming soon"}</p>
    </div>
  );
}
