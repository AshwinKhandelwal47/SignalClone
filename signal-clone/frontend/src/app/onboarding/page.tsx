"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { BackIcon, LockIcon, SignalLogo } from "@/components/ui/Icons";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

type Step = "welcome" | "identifier" | "code" | "profile";

const DEMO_ACCOUNTS = ["+15550000001 (Alice)", "+15550000002 (Bob)", "carol", "emma"];

export default function OnboardingPage() {
  const router = useRouter();
  const { status, user, init, signIn, setUser } = useAuthStore();
  const [step, setStep] = useState<Step>("welcome");
  const [identifier, setIdentifier] = useState("");
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    init();
  }, [init]);

  // Already signed in: finish profile setup if needed, otherwise go to the app.
  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    if (user.display_name) router.replace("/chats");
    else setStep("profile");
  }, [status, user, router]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const submitIdentifier = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const result = await api.requestOtp(identifier);
      setIdentifier(result.identifier);
      setOtpHint(result.otp_hint);
      setCode("");
      setStep("code");
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const result = await api.verifyOtp(identifier, code);
      signIn(result.token, result.user);
      // The effect above routes to /chats or the profile step.
    });
  };

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      setUser(await api.updateProfile({ display_name: name }));
    });
  };

  const uploadAvatar = (file: File | undefined) => {
    if (!file) return;
    run(async () => {
      setUser(await api.uploadAvatar(file));
      toast("Profile photo updated");
    });
  };

  const goBack = () => {
    setError(null);
    setStep(step === "code" ? "identifier" : "welcome");
  };

  return (
    <main className="flex h-full items-center justify-center bg-chat p-4">
      <div className="relative w-full max-w-sm">
        {(step === "identifier" || step === "code") && (
          <button className="icon-button absolute -top-12 left-0" onClick={goBack} aria-label="Back">
            <BackIcon />
          </button>
        )}

        {step === "welcome" && (
          <div className="flex flex-col items-center text-center">
            <SignalLogo size={96} />
            <h1 className="mt-8 text-[28px] leading-9 font-semibold">Take privacy with you.</h1>
            <p className="mt-1 text-[17px] text-secondary">Be yourself in every message.</p>
            <button className="btn-primary mt-10 w-full py-3" onClick={() => setStep("identifier")}>
              Continue
            </button>
            <p className="mt-4 flex items-center gap-1 text-[12px] text-tertiary">
              <LockIcon size={14} /> Messages are end-to-end encrypted (simulated)
            </p>
          </div>
        )}

        {step === "identifier" && (
          <form onSubmit={submitIdentifier} className="flex flex-col">
            <h1 className="text-[22px] font-semibold">Phone number or username</h1>
            <p className="mt-2 text-secondary">
              Enter your phone number with country code, or a username, to get started.
            </p>
            <input
              className="form-field mt-6 py-3 text-[16px]"
              placeholder="+1 555 000 0001 or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
              autoComplete="tel"
            />
            {error && <p className="mt-2 text-[13px] text-accent-red">{error}</p>}
            <button className="btn-primary mt-6 py-3" disabled={busy || identifier.trim().length < 3}>
              Next
            </button>
            <div className="mt-8 rounded-lg bg-hover p-3 text-[13px] text-secondary">
              <p className="font-medium text-primary">Demo accounts</p>
              <p className="mt-1">{DEMO_ACCOUNTS.join(" · ")}</p>
              <p className="mt-1">Or enter any new number/username to register.</p>
            </div>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={submitCode} className="flex flex-col">
            <h1 className="text-[22px] font-semibold">Verification code</h1>
            <p className="mt-2 text-secondary">
              Enter the code we sent to <span className="text-primary">{identifier}</span>
            </p>
            <input
              className="form-field mt-6 py-3 text-center text-[22px] tracking-[0.5em]"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              autoComplete="one-time-code"
            />
            {error && <p className="mt-2 text-[13px] text-accent-red">{error}</p>}
            {otpHint && (
              <p className="mt-3 text-center text-[13px] text-tertiary">
                Demo mode: your code is <span className="font-medium text-primary">{otpHint}</span>
              </p>
            )}
            <button className="btn-primary mt-6 py-3" disabled={busy || code.length !== 6}>
              Continue
            </button>
          </form>
        )}

        {step === "profile" && user && (
          <form onSubmit={submitProfile} className="flex flex-col items-center">
            <h1 className="text-[22px] font-semibold">Set up your profile</h1>
            <p className="mt-2 text-center text-secondary">
              Your profile is visible to people you message, contacts and groups.
            </p>
            <button
              type="button"
              className="mt-6 rounded-full transition-opacity hover:opacity-80"
              onClick={() => fileInput.current?.click()}
              aria-label="Choose profile photo"
            >
              <Avatar name={name || "?"} color={user.avatar_color} url={user.avatar_url} size={88} />
            </button>
            <button
              type="button"
              className="mt-2 text-[13px] text-ultramarine"
              onClick={() => fileInput.current?.click()}
            >
              {user.avatar_url ? "Change photo" : "Add photo"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => uploadAvatar(e.target.files?.[0])}
            />
            <input
              className="form-field mt-6 py-3 text-[16px]"
              placeholder="Your name (required)"
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {error && <p className="mt-2 self-start text-[13px] text-accent-red">{error}</p>}
            <button className="btn-primary mt-6 w-full py-3" disabled={busy || !name.trim()}>
              Next
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
