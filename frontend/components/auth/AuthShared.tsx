"use client";

import { Check, Globe, KeyRound, Shield, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ZoomWordmark } from "@/components/auth/ZoomWordmark";
import { completeAuth } from "@/lib/auth";

export function AuthTopBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-[#e8f3ff] px-4 py-2 text-sm text-ink">
      <p className="min-w-0 flex-1 text-center sm:text-left">
        <span className="mr-1 inline-block rounded-full bg-zoom-blue px-1.5 text-xs text-white">
          i
        </span>
        You may stay signed in longer on this device.{" "}
        <button type="button" className="text-zoom-blue hover:underline">
          Learn more
        </button>
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="shrink-0 rounded p-1 text-ink-soft hover:bg-black/5"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function AuthHeader({ showSignInLink = true }: { showSignInLink?: boolean }) {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <Link href="/welcome" className="inline-block">
        <ZoomWordmark size="sm" />
      </Link>
      <div className="flex items-center gap-4 text-sm text-ink-soft">
        {showSignInLink && (
          <span>
            Already have an account?{" "}
            <Link href="/signin" className="font-medium text-zoom-blue hover:underline">
              Sign In
            </Link>
          </span>
        )}
        <button type="button" className="hover:text-ink">
          Support
        </button>
        <button type="button" className="flex items-center gap-1 hover:text-ink">
          English
          <span className="text-xs">▾</span>
        </button>
      </div>
    </header>
  );
}

export function WelcomeDownloadCard() {
  return (
    <div className="absolute right-6 top-6 hidden max-w-[280px] rounded-[8px] border border-[#e0e0e0] bg-[#f7f7f8] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:block">
      <p className="text-[14px] font-bold leading-snug text-[#232333]">Download the Zoom app</p>
      <p className="mt-1 text-[12px] leading-snug text-[#6e7680]">
        Download Zoom to access Chat, Phone, Docs, and more!
      </p>
    </div>
  );
}

export function WelcomeFooter() {
  return (
    <footer className="flex items-center justify-center gap-3 py-8 text-[12px] text-[#6e7680]">
      <button type="button" className="hover:text-[#232333]">
        About Zoom
      </button>
      <span className="text-[#d1d1d1]">|</span>
      <button type="button" className="flex items-center gap-1 hover:text-[#232333]">
        <Globe size={12} strokeWidth={1.75} />
        English
        <span className="text-[10px] leading-none">▴</span>
      </button>
    </footer>
  );
}

export function AuthShieldBadge() {
  return (
    <div className="fixed bottom-4 left-4 text-zoom-blue">
      <Shield size={18} fill="currentColor" className="opacity-80" />
    </div>
  );
}

const FEATURES = [
  "Get up to 40 minutes and 100 participants per meeting",
  "Share AI Docs",
  "Get 3 editable whiteboards",
  "Unlimited instant messaging",
  "Create up to 5 two-minute video messages",
];

export function SignUpSidebar({ variant = "birth" }: { variant?: "birth" | "email" }) {
  const bannerSrc =
    variant === "email" ? "/auth/banner-signup.png" : "/auth/banner-signin.png";

  return (
    <div className="relative hidden min-h-full flex-col bg-[#f7f7f8] px-10 py-12 lg:flex lg:w-[42%]">
      <div className="flex flex-1 flex-col items-center justify-center">
        <Image
          src={bannerSrc}
          alt=""
          width={360}
          height={280}
          className="h-auto w-full max-w-[360px] object-contain"
          priority
        />
      </div>
      <div className="rounded-xl border border-black/5 bg-white p-6 shadow-sm">
        <p className="text-lg font-semibold text-ink">Create your free Basic account</p>
        <ul className="mt-4 space-y-3">
          {FEATURES.map((text) => (
            <li key={text} className="flex items-start gap-2 text-sm text-ink-soft">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={12} strokeWidth={3} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <AuthShieldBadge />
    </div>
  );
}

export function SignInIllustration() {
  return (
    <div className="hidden min-h-full items-center justify-center bg-[#f7f7f8] px-10 lg:flex lg:w-[50%]">
      <Image
        src="/auth/banner-signin.png"
        alt=""
        width={420}
        height={320}
        className="h-auto w-full max-w-[420px] object-contain"
        priority
      />
    </div>
  );
}

interface SocialProvider {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const PROVIDERS: SocialProvider[] = [
  { id: "sso", label: "SSO", icon: <KeyRound size={22} className="text-ink" /> },
  {
    id: "apple",
    label: "Apple",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
    ),
  },
  {
    id: "google",
    label: "Google",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#1877F2" aria-hidden>
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
  },
  {
    id: "microsoft",
    label: "Microsoft",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
        <path fill="#F25022" d="M1 1h10v10H1z" />
        <path fill="#7FBA00" d="M13 1h10v10H13z" />
        <path fill="#00A4EF" d="M1 13h10v10H1z" />
        <path fill="#FFB900" d="M13 13h10v10H13z" />
      </svg>
    ),
  },
];

export function SocialSignInButtons({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSocial(id: string) {
    setLoading(id);
    await new Promise((r) => setTimeout(r, 700));
    const name =
      id === "google"
        ? "Google User"
        : id === "apple"
          ? "Apple User"
          : id === "facebook"
            ? "Facebook User"
            : id === "microsoft"
              ? "Microsoft User"
              : "Demo User";
    completeAuth(name);
    router.push("/");
  }

  return (
    <div className="mt-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
        <span className="relative bg-white px-3 text-sm text-ink-soft">
          Or {mode === "signin" ? "sign in" : "sign up"} with
        </span>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-4">
        {PROVIDERS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            disabled={loading !== null}
            onClick={() => void handleSocial(id)}
            className="flex w-16 flex-col items-center gap-2 disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/15 bg-white shadow-sm transition hover:border-black/25">
              {loading === id ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-zoom-blue border-t-transparent" />
              ) : (
                icon
              )}
            </span>
            <span className="text-xs text-ink-soft">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AuthLegalFooter({ mode }: { mode: "signin" | "signup" }) {
  return (
    <div className="mt-8 space-y-3 text-center text-xs text-ink-soft">
      {mode === "signin" && (
        <>
          <button type="button" className="text-zoom-blue hover:underline">
            Forgot email?
          </button>
          <div className="flex justify-center gap-4 text-zoom-blue">
            <button type="button" className="hover:underline">
              Help
            </button>
            <button type="button" className="hover:underline">
              Terms
            </button>
            <button type="button" className="hover:underline">
              Privacy
            </button>
          </div>
        </>
      )}
      {mode === "signup" && (
        <p>
          Zoom is protected by reCAPTCHA and the Google{" "}
          <button type="button" className="text-zoom-blue hover:underline">
            Privacy Policy
          </button>{" "}
          and{" "}
          <button type="button" className="text-zoom-blue hover:underline">
            Terms of Service
          </button>{" "}
          apply.
        </p>
      )}
    </div>
  );
}
