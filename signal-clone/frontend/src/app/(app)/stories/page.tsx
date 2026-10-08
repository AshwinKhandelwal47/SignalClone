import { ComingSoon } from "@/components/ui/ComingSoon";
import { StoriesIcon } from "@/components/ui/Icons";

export default function StoriesPage() {
  return (
    <ComingSoon
      icon={<StoriesIcon size={28} />}
      title="Stories"
      description="Coming soon. Share moments that disappear after 24 hours."
    />
  );
}
