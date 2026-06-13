"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AuthLegalFooter,
  AuthShieldBadge,
  AuthTopBanner,
  SignInIllustration,
  SocialSignInButtons,
} from "@/components/auth/AuthShared";
import { completeAuth } from "@/lib/auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleNext(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const name = email.includes("@") ? email.split("@")[0] : "Demo User";
    completeAuth(name);
    router.push("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AuthTopBanner />
      <div className="flex min-h-0 flex-1">
        <SignInIllustration />
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-md">
            <h1 className="text-center text-3xl font-bold text-ink">Sign in</h1>

            <form onSubmit={(e) => void handleNext(e)} className="mt-8 space-y-4">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email or phone number"
                className="w-full rounded-lg border-2 border-zoom-blue px-4 py-3 text-base outline-none placeholder:text-ink-soft/70 focus:ring-2 focus:ring-zoom-blue/20"
              />
              <button
                type="submit"
                disabled={!email.trim() || loading}
                className="w-full rounded-lg bg-zoom-blue py-3 text-base font-medium text-white transition hover:bg-zoom-blue-hover disabled:bg-[#c5c8cd] disabled:text-white/90"
              >
                {loading ? "Signing in…" : "Next"}
              </button>
            </form>

            <SocialSignInButtons mode="signin" />
            <AuthLegalFooter mode="signin" />

            <p className="mt-6 text-center text-sm text-ink-soft">
              New to Zoom?{" "}
              <Link href="/signup" className="text-zoom-blue hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
      <AuthShieldBadge />
    </div>
  );
}
