import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const viewport: Viewport = {
  themeColor: "#6366F1"
};

export const metadata: Metadata = {
  title: "Fish Market Ledger",
  description: "Digital Accounts for Fishing Agents",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fish Ledger",
  },
};

import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/components/ui/Toast';
import { BetaWatermark } from '@/components/beta/BetaWatermark';
import { FeedbackWidget } from '@/components/beta/FeedbackWidget';
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "314116827404-kf90nn217jkqvmcf2kd11lvu3gbmhngo.apps.googleusercontent.com"}>
          <LanguageProvider>
            <AuthProvider>
              <ToastProvider>
                <BetaWatermark />
                {children}
                <aside aria-label="Feedback and Support">
                  <FeedbackWidget />
                </aside>
              </ToastProvider>
            </AuthProvider>
          </LanguageProvider>
        </GoogleOAuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    // SW registered
                  }, function(err) {
                    console.error('SW registration failed: ', err);
                  });
                });

                // FIX 2 fallback: For browsers without Background Sync support,
                // message the SW to flush the offline mutation queue whenever the
                // user returns focus to the tab (a reliable proxy for "back online").
                window.addEventListener('focus', function() {
                  if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'PAGE_FOCUS_RETRY' });
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
