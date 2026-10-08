import { ComingSoon } from "@/components/ui/ComingSoon";
import { PhoneIcon } from "@/components/ui/Icons";

export default function CallsPage() {
  return (
    <ComingSoon
      icon={<PhoneIcon size={28} />}
      title="Voice and video calls"
      description="Coming soon. Calls are a placeholder in this Signal clone."
    />
  );
}
