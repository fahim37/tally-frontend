"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";

/**
 * Sign in — two fields, nothing else.
 *
 * No name, no confirm-password, no verification gate. The account is created
 * with whatever's typed here and everything else (currency, budget, tiles)
 * gets a working default that onboarding then revises. That's what keeps this
 * one screen instead of three.
 *
 * Auth is local-only until the API's /auth routes exist; the submit handler is
 * the single place that changes when they do.
 */
export function SignIn() {
  const { state, dispatch } = useTally();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailLooksValid && password.length >= 8 && !busy;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!emailLooksValid) return setError("That doesn't look like an email address.");
    if (password.length < 8) return setError("Use at least 8 characters.");

    setBusy(true);
    // TODO: POST /auth/signup — falls through to local state until it exists.
    dispatch({
      type: "UPDATE_PROFILE",
      patch: { email: email.trim().toLowerCase(), signedIn: true, authProvider: "email" },
    });
    router.replace(state.profile.onboardingCompleted ? "/" : "/onboarding");
  };

  const continueWithGoogle = () => {
    // TODO: Google Identity Services → POST /auth/google with the ID token.
    setError("Google sign-in needs the API, which isn't connected yet. Use an email for now.");
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center px-7 pb-16 pt-10">
      <span
        className="mb-7 flex size-11 items-center justify-center rounded-[14px]"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        <Icon name="logo" size={25} strokeWidth={2} />
      </span>

      <h1
        className="mb-2.5 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.035em]"
        style={{ color: "var(--text)" }}
      >
        Sign in to Tally
      </h1>
      <p className="mb-7 text-[15px] leading-[1.5]" style={{ color: "var(--muted)" }}>
        Your tiles and history follow you to any phone.
      </p>

      <form onSubmit={submit} noValidate>
        <label
          className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--muted)" }}
          htmlFor="signin-email"
        >
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="rafi@example.com"
          autoComplete="email"
          inputMode="email"
          className="mb-4 w-full rounded-[13px] border px-3.5 py-4 text-[15px] outline-none"
          style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
        />

        <label
          className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--muted)" }}
          htmlFor="signin-password"
        >
          Password
        </label>
        <input
          id="signin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          autoComplete="current-password"
          className="mb-2 w-full rounded-[13px] border px-3.5 py-4 text-[15px] outline-none"
          style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--text)" }}
        />

        {error && (
          <p role="alert" className="mb-3 text-[13px] leading-[1.4]" style={{ color: "var(--amber)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-3 w-full rounded-[13px] py-4 text-[15px] font-semibold transition-opacity disabled:opacity-40"
          style={{ background: "var(--blue)", color: "#FFFFFF" }}
        >
          Continue
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        <span className="text-[12px]" style={{ color: "var(--faint)" }}>
          or
        </span>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>

      <button
        type="button"
        onClick={continueWithGoogle}
        className="flex w-full items-center justify-center gap-2.5 rounded-[13px] border py-4 text-[15px] font-medium"
        style={{ borderColor: "var(--line)", color: "var(--text)" }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.71-1.57 2.69-3.89 2.69-6.63Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33Z" />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z"
          />
        </svg>
        Continue with Google
      </button>

      <p className="mt-7 text-[12px] leading-[1.5]" style={{ color: "var(--faint)" }}>
        Signing in stores your account on this device. Nothing is sent anywhere until the
        Tally server is connected.
      </p>
    </div>
  );
}

export default SignIn;
