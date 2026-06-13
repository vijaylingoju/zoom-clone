"use client";

import Link from "next/link";

import { WelcomeDownloadCard, WelcomeFooter } from "@/components/auth/AuthShared";

export default function WelcomePage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      <WelcomeDownloadCard />

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[28px] font-black lowercase leading-none tracking-[-0.02em] text-zoom-blue">
            zoom
          </p>
          <h1 className="mt-2 text-[48px] font-bold leading-[1.05] tracking-[-0.03em] text-[#232333] sm:text-[56px]">
            Workplace
          </h1>
        </div>

        <div className="mt-10 flex w-[320px] max-w-full flex-col gap-3">
          <Link
            href="/signin"
            className="rounded-[8px] bg-zoom-blue py-[14px] text-center text-[16px] font-bold leading-none text-white transition hover:bg-zoom-blue-hover"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-[8px] border border-[#d1d1d1] bg-white py-[14px] text-center text-[16px] font-bold leading-none text-[#232333] transition hover:bg-[#f7f7f8]"
          >
            Sign Up
          </Link>
          <Link
            href="/join"
            className="rounded-[8px] border border-[#d1d1d1] bg-white py-[14px] text-center text-[16px] font-bold leading-none text-[#232333] transition hover:bg-[#f7f7f8]"
          >
            Join Meeting
          </Link>
        </div>
      </main>

      <WelcomeFooter />
    </div>
  );
}
