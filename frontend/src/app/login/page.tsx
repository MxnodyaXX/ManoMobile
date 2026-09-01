"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AlertCircle } from "lucide-react";

const ff = "'Plus Jakarta Sans', sans-serif";

function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const configured = isSupabaseConfigured();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    // Back to wherever proxy.ts intercepted them.
    router.replace(params.get("next") || "/");
    router.refresh();
  };

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 9,
    border: "1px solid var(--border)", background: "var(--bg-card)",
    color: "var(--text-primary)", fontSize: 13.5, fontFamily: ff,
    outline: "none", boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)",
    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block", fontFamily: ff,
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)", padding: 20, fontFamily: ff,
    }}>
      <form
        onSubmit={submit}
        style={{
          width: "min(400px, 100%)", background: "var(--bg-card)",
          border: "1px solid var(--border)", borderRadius: 16, padding: "30px 28px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, margin: "0 auto 12px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#fff", border: "1px solid var(--border)", padding: 7,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ManoMobileBlack.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h1 className="heading" style={{ fontSize: 20, color: "var(--text-primary)" }}>Mano Mobile</h1>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>
            Sign in with your staff account
          </p>
        </div>

        {!configured && (
          <div style={{
            display: "flex", gap: 8, padding: "10px 12px", borderRadius: 10, marginBottom: 16,
            background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)",
          }}>
            <AlertCircle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Supabase isn&apos;t configured yet. Add <strong>NEXT_PUBLIC_SUPABASE_URL</strong> and{" "}
              <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong> to <code>.env.local</code> — see{" "}
              <code>docs/BACKEND-SETUP.md</code>.
            </p>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={label} htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="username" style={input}
            placeholder="you@manomobile.lk" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={label} htmlFor="password">Password</label>
          <input id="password" type="password" required autoComplete="current-password" style={input}
            placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && (
          <div style={{
            display: "flex", gap: 8, padding: "9px 12px", borderRadius: 9, marginBottom: 14,
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)",
          }}>
            <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%", padding: "11px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "var(--accent-fg)",
            fontSize: 14, fontWeight: 700, fontFamily: ff,
            cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to keep this route static-friendly.
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthProvider>
  );
}
