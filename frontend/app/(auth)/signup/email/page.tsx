"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  AuthHeader,
  AuthLegalFooter,
  AuthShieldBadge,
  SignUpSidebar,
  SocialSignInButtons,
} from "@/components/auth/AuthShared";
import { completeAuth } from "@/lib/auth";

function SignUpEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const year = params.get("year");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleContinue(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const name = email.split("@")[0] || "New User";
    completeAuth(name);
    router.push("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader />
      <div className="flex min-h-0 flex-1">
        <SignUpSidebar variant="email" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <h1 className="text-center text-3xl font-bold text-ink">Sign up</h1>
            {year && (
              <p className="mt-2 text-center text-xs text-ink-soft">Birth year: {year}</p>
            )}

            <form onSubmit={(e) => void handleContinue(e)} className="mt-8 space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-lg border-2 border-zoom-blue px-4 py-3 text-base outline-none placeholder:text-ink-soft/70 focus:ring-2 focus:ring-zoom-blue/20"
              />
              <button
                type="submit"
                disabled={!email.trim() || loading}
                className="w-full rounded-lg bg-[#c5c8cd] py-3 text-base font-medium text-white transition enabled:bg-zoom-blue enabled:hover:bg-zoom-blue-hover disabled:cursor-not-allowed"
              >
                {loading ? "Creating account…" : "Continue"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-ink-soft">
              By proceeding, I agree to Zoom&apos;s{" "}
              <button type="button" className="text-zoom-blue hover:underline">
                Privacy Statement
              </button>{" "}
              and{" "}
              <button type="button" className="text-zoom-blue hover:underline">
                Terms of Service
              </button>
              .
            </p>

            <SocialSignInButtons mode="signup" />
            <AuthLegalFooter mode="signup" />

            <p className="mt-4 text-center text-sm text-ink-soft">
              Already have an account?{" "}
              <Link href="/signin" className="text-zoom-blue hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="lg:hidden">
        <AuthShieldBadge />
      </div>
    </div>
  );
}

export default function SignUpEmailPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center text-ink-soft">Loading…</div>}
    >
      <SignUpEmailForm />
    </Suspense>
  );
}
