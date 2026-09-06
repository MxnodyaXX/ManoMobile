import type { Metadata, Viewport } from "next";
import { ThemeProvider, THEME_SCRIPT } from "@/lib/ui/theme";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { ToastProvider } from "@/lib/ui/toast";
import AppearanceProvider from "@/lib/settings/AppearanceProvider";
import NumberScrollGuard from "@/lib/ui/NumberScrollGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mano Mobile",
  description: "Mobile Repair Management Dashboard",
  icons: { icon: "/ManoMobileBlack.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/*
          The stored light/dark mode, applied before the first paint.

          A plain tag rendered by this Server Component, not next/script and
          not a client component. Both of those defer it: next/script's
          beforeInteractive only queues the source for Next's loader, so the
          page can paint in the wrong palette first, and a client component is
          what made React print "Encountered a script tag while rendering React
          component" on every load. Emitted here it is real markup in the
          streamed HTML, executed by the parser the moment it is reached and
          hydrated rather than re-created.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <NumberScrollGuard />
        <ThemeProvider>
          <AuthProvider>
            <AppearanceProvider>
              <ToastProvider>{children}</ToastProvider>
            </AppearanceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}