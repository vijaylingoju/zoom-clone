"use client";

import Link from "next/link";

import { WelcomeDownloadCard, WelcomeFooter } from "@/components/auth/AuthShared";
import { ZoomWordmark } from "@/components/auth/ZoomWordmark";

export default function WelcomePage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      <WelcomeDownloadCard />

      <main className="flex flex-1 flex-col items-center px-6 pt-[clamp(9rem,30vh,15rem)]">
        <div className="text-center">
          <ZoomWordmark />
          <h1 className="mt-1.5 text-[52px] font-bold leading-[1.02] tracking-[-0.04em] text-[#0e1e3d] sm:text-[60px]">
            Workplace
          </h1>
        </div>

        <div className="mt-[72px] flex w-[320px] max-w-full flex-col gap-4">
          <Link
            href="/signin"
            className="rounded-[10px] bg-[#0e71eb] py-[15px] text-center text-[16px] font-medium leading-none text-white transition hover:bg-zoom-blue-hover"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-[10px] border border-[#d9d9d9] bg-white py-[15px] text-center text-[16px] font-medium leading-none text-[#0e1e3d] transition hover:bg-[#f7f7f8]"
          >
            Sign Up
          </Link>
          <Link
            href="/join"
            className="rounded-[10px] border border-[#d9d9d9] bg-white py-[15px] text-center text-[16px] font-medium leading-none text-[#0e1e3d] transition hover:bg-[#f7f7f8]"
          >
            Join Meeting
          </Link>
        </div>
      </main>

      <WelcomeFooter />
    </div>
  );
}
