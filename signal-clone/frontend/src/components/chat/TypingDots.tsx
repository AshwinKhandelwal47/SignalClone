export function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-label="typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="typing-dot h-[6px] w-[6px] rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
