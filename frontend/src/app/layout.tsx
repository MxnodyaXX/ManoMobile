import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/ui/theme";
import { AuthProvider } from "@/lib/auth/AuthContext";
import RequireSignIn from "@/lib/auth/RequireSignIn";
import { ToastProvider } from "@/lib/ui/toast";
import AppearanceProvider from "@/lib/settings/AppearanceProvider";
import NumberInputGuards from "@/lib/ui/NumberInputGuards";
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
        <NumberInputGuards />
        <ThemeProvider>
          <AuthProvider>
            <AppearanceProvider>
              {/* Inside AuthProvider, because it is the only thing that knows
                  whether this tab has anybody in it. See RequireSignIn. */}
              <ToastProvider>
                <RequireSignIn>{children}</RequireSignIn>
              </ToastProvider>
            </AppearanceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}