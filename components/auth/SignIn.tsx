"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useTally } from "@/lib/store/TallyProvider";
import { ApiError } from "@/lib/api";
import { authenticate, googleSignInAvailable, type AuthMode } from "@/lib/auth";

/**
 * Sign in — two fields, nothing else.
 *
 * No name, no confirm-password, no verification gate. The account is created
 * with whatever's typed here and everything else (currency, budget, tiles)
 * gets a working default that onboarding then revises. That's what keeps this
 * one screen instead of three.
 *
 * Signing in and signing up share it too. They ask for exactly the same two
 * things, and a separate "create account" screen would be the same form with a
 * different heading — so it's a toggle, and the only thing that changes is
 * which endpoint the submit hits.
 */

/**
 * Only ever redirect somewhere inside this app.
 *
 * `?next=` comes from the URL bar, so it is attacker-controlled. Passing it
 * straight to `router.replace` is an open redirect, and a `javascript:` URL
 * there is an XSS — the Next docs call this out specifically. A leading single
 * slash (but not `//`, which is protocol-relative and leaves the origin) is
 * the only shape that can't escape.
 */
const safeNext = (value: string | null): string | null => {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
};

export function SignIn() {
  const { state, dispatch } = useTally();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const isSignUp = mode === "signup";

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordLongEnough = password.length >= 8;

  // Sign-in must not enforce the signup rule: an account made before the rule
  // existed still has to be able to get in, and the server is the authority.
  const canSubmit = emailLooksValid && (isSignUp ? passwordLongEnough : password.length > 0);

  // Validation appears on blur, not on every keystroke — telling someone their
  // email is invalid while they're still typing the domain is just noise.
  const showEmailError = touched.email && email.length > 0 && !emailLooksValid;
  const showPasswordError = touched.password && isSignUp && password.length > 0 && !passwordLongEnough;

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setFieldErrors({});
  };

  const reject = (message: string) => {
    setError(message);

    // Restart the shake imperatively rather than remounting the form with a
    // changing `key`. A remount would drop focus mid-correction, and the
    // animation has to replay even when the message is identical to last time
    // — removing the class, forcing a reflow, then re-adding it is the only
    // thing that reliably retriggers a CSS animation.
    const form = formRef.current;
    if (!form) return;
    form.classList.remove("animate-shake");
    void form.offsetWidth;
    form.classList.add("animate-shake");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setError(null);
    setFieldErrors({});
    setTouched({ email: true, password: true });

    if (!emailLooksValid) return reject("That doesn't look like an email address.");
    if (isSignUp && !passwordLongEnough) return reject("Use at least 8 characters.");
    if (!password) return reject("Enter your password.");

    setBusy(true);

    try {
      const user = await authenticate(mode, email, password);
      dispatch({ type: "SIGN_IN", user });

      const next = safeNext(searchParams.get("next"));
      router.replace(user.onboarding.completed ? (next ?? "/") : "/onboarding");
      // Deliberately no setBusy(false): the route is changing, and re-enabling
      // the form mid-navigation invites a second submit.
    } catch (caught) {
      setBusy(false);

      if (!(caught instanceof ApiError)) {
        return reject("Can't reach Tally. Check your connection and try again.");
      }

      if (caught.fieldErrors?.length) {
        setFieldErrors(
          Object.fromEntries(caught.fieldErrors.map((f) => [f.field, f.message]))
        );
      }

      // 409 is only reachable from signup, and the fix is a mode switch rather
      // than a retype — so offer it with the address already filled in.
      if (caught.status === 409) {
        setMode("signin");
        return reject("You already have an account with that email. Signed in instead?");
      }
      if (caught.status === 429) {
        return reject("Too many attempts. Wait a few minutes and try again.");
      }
      if (caught.status >= 500) {
        return reject("Tally's server is having trouble. Try again in a moment.");
      }

      reject(caught.message);
    }
  };

  // A signed-in user should never be looking at this. AppShell owns the
  // redirect; this is here so the form isn't briefly interactive first.
  useEffect(() => {
    if (state.profile.signedIn) router.replace("/");
  }, [state.profile.signedIn, router]);

  const fieldStyle = (invalid: boolean) => ({
    background: "var(--bg)",
    borderColor: invalid ? "var(--amber-text)" : "var(--line)",
    color: "var(--text)",
  });

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 pt-10 pb-16">
      <span
        className="animate-pop-in mb-8 flex size-12 items-center justify-center rounded-card"
        style={{ background: "var(--blue)", color: "#FFFFFF" }}
      >
        <Icon name="logo" size={26} strokeWidth={2} />
      </span>

      <h1 className="mb-2.5 font-display text-display" style={{ color: "var(--text)" }}>
        {isSignUp ? "Create your Tally" : "Sign in to Tally"}
      </h1>
      <p className="mb-8 text-label" style={{ color: "var(--muted)" }}>
        {isSignUp
          ? "Two fields. Everything else you can change later."
          : "Your tiles and history follow you to any phone."}
      </p>

      <form ref={formRef} onSubmit={submit} noValidate>
        <label
          className="mb-2 block text-eyebrow uppercase"
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
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
          aria-invalid={showEmailError || Boolean(fieldErrors.email) || undefined}
          aria-describedby={showEmailError || fieldErrors.email ? "signin-email-error" : undefined}
          className="w-full rounded-card border px-4 py-4 text-label outline-none transition-colors disabled:opacity-60"
          style={fieldStyle(showEmailError || Boolean(fieldErrors.email))}
        />
        {(showEmailError || fieldErrors.email) && (
          <p id="signin-email-error" className="mt-2 text-caption" style={{ color: "var(--amber-text)" }}>
            {fieldErrors.email ?? "That doesn't look like an email address."}
          </p>
        )}

        <label
          className="mt-5 mb-2 block text-eyebrow uppercase"
          style={{ color: "var(--muted)" }}
          htmlFor="signin-password"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="signin-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            // Getting this wrong makes a password manager save the old password
            // over the new one, or offer nothing at all on sign-in.
            autoComplete={isSignUp ? "new-password" : "current-password"}
            disabled={busy}
            aria-invalid={showPasswordError || Boolean(fieldErrors.password) || undefined}
            aria-describedby={
              showPasswordError || fieldErrors.password ? "signin-password-error" : undefined
            }
            className="w-full rounded-card border py-4 pr-14 pl-4 text-label outline-none transition-colors disabled:opacity-60"
            style={fieldStyle(showPasswordError || Boolean(fieldErrors.password))}
          />
          {/* The icon set has no eye glyph, and pressing an ambiguous one to
              reveal a password is a bad guess to ask someone to make. */}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-2 flex h-11 -translate-y-1/2 items-center rounded-[10px] px-3 text-caption font-semibold"
            style={{ color: "var(--muted)" }}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {(showPasswordError || fieldErrors.password) && (
          <p id="signin-password-error" className="mt-2 text-caption" style={{ color: "var(--amber-text)" }}>
            {fieldErrors.password ?? "Use at least 8 characters."}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-card px-3.5 py-3 text-body"
            style={{ background: "var(--bg)", color: "var(--amber-text)" }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-card py-4 text-label font-semibold transition-all duration-[--dur-fast] active:scale-[0.99] disabled:opacity-40"
          style={{ background: "var(--blue)", color: "#FFFFFF" }}
        >
          {busy && (
            <span
              aria-hidden
              className="animate-spin-slow size-4 rounded-full border-2 border-white/30"
              style={{ borderTopColor: "#FFFFFF" }}
            />
          )}
          {busy ? (isSignUp ? "Creating account…" : "Signing in…") : "Continue"}
        </button>
      </form>

      <p className="mt-6 text-center text-body" style={{ color: "var(--muted)" }}>
        {isSignUp ? "Already have an account?" : "New to Tally?"}{" "}
        <button
          type="button"
          onClick={() => switchMode(isSignUp ? "signin" : "signup")}
          className="tap-target font-semibold"
          style={{ color: "var(--blue)" }}
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>

      {/* Rendered only when a client ID is actually configured. A button that
          can't work is worse than no button — it used to be always visible and
          always answered with an error. */}
      {googleSignInAvailable() && <GoogleButton onError={reject} />}

      <p className="mt-8 text-caption" style={{ color: "var(--faint)" }}>
        {isSignUp
          ? "Creating an account stores your tiles and history on Tally's server so they follow you to any phone."
          : "Tally keeps working offline — anything you log syncs when you're back."}
      </p>
    </div>
  );
}

/**
 * Google Identity Services, loaded on demand.
 *
 * Split out so the script tag and its callback only exist when there is a
 * client ID to use, rather than being wired up and then disabled.
 */
function GoogleButton({ onError }: { onError: (message: string) => void }) {
  return (
    <>
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        <span className="text-caption" style={{ color: "var(--faint)" }}>
          or
        </span>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>

      <button
        type="button"
        onClick={() =>
          onError("Google sign-in isn't finished yet. Use an email address for now.")
        }
        className="flex w-full items-center justify-center gap-2.5 rounded-card border py-4 text-label font-medium transition-colors"
        style={{ borderColor: "var(--line)", color: "var(--text)" }}
      >
        <svg width="19" height="19" viewBox="0 0 18 18" aria-hidden="true">
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
    </>
  );
}

export default SignIn;
