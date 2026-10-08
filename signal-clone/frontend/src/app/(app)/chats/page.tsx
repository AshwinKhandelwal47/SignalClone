import { SignalLogo } from "@/components/ui/Icons";

export default function ChatsEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <SignalLogo size={88} />
      <h2 className="text-[20px] font-semibold">Welcome to Signal</h2>
      <p className="max-w-xs text-secondary">Privacy is possible. Select a chat to start messaging.</p>
    </div>
  );
}
