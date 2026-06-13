"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHeader, AuthShieldBadge, SignUpSidebar } from "@/components/auth/AuthShared";

export default function SignUpBirthYearPage() {
  const router = useRouter();
  const [year, setYear] = useState("");

  const currentYear = new Date().getFullYear();
  const valid =
    /^\d{4}$/.test(year) &&
    Number(year) >= 1900 &&
    Number(year) <= currentYear - 13;

  function handleContinue(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    router.push(`/signup/email?year=${encodeURIComponent(year)}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader />
      <div className="flex min-h-0 flex-1">
        <SignUpSidebar />
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-lg text-center">
            <h1 className="text-3xl font-bold text-ink sm:text-4xl">Get started with Zoom</h1>
            <p className="mt-4 text-sm text-ink-soft sm:text-base">
              To create your Zoom account, please enter your birth year. This data won&apos;t be
              stored.
            </p>

            <form onSubmit={handleContinue} className="mt-10 space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Birth year"
                className="w-full rounded-lg border border-black/15 px-4 py-3.5 text-center text-base outline-none focus:border-zoom-blue focus:ring-2 focus:ring-zoom-blue/20"
              />
              <button
                type="submit"
                disabled={!valid}
                className="w-full rounded-lg bg-[#c5c8cd] py-3.5 text-base font-medium text-white transition enabled:bg-zoom-blue enabled:hover:bg-zoom-blue-hover disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </form>

            <p className="mt-8 text-sm text-ink-soft">
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
