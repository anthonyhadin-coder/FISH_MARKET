import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: "#6366F1"
};

export const metadata: Metadata = {
  title: {
    default: "Fish Market Ledger | Digital Accounts for Fishing Agents",
    template: "%s | Fish Market Ledger"
  },
  description: "Advanced digital bookkeeping for professional fishing agents and boat owners. Track sales, expenses, and salaries with offline support and localized Tamil interface.",
  keywords: ["fish market", "fishing ledger", "digital accounts", "Tamil fishing app", "boat management", "Fisheries OS"],
  manifest: "/manifest.json",
  authors: [{ name: "Fish Market Ledger Team" }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://fishmarketledger.com", // Fallback URL
    title: "Fish Market Ledger | Digital Accounts for Fishing Agents",
    description: "Modernize your fishing business with professional digital accounts, offline sync, and multi-language support.",
    siteName: "Fish Market Ledger",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fish Market Ledger | Digital Accounts for Fishing Agents",
    description: "Professional digital accounts for the fishing industry. Track your catch with ease.",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fish Ledger",
  },
};

import Script from 'next/script';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/components/ui/Toast';
import { FeedbackWidget } from '@/components/beta/FeedbackWidget';
import { StableGoogleAuthProvider } from '@/components/providers/GoogleAuthProvider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
  if (!googleClientId && process.env.NODE_ENV !== 'production') {
    console.warn('[Layout] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google Auth will not work.');
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ocean-600 focus:text-white focus:rounded-lg">
          Skip to main content
        </a>
        {googleClientId ? (
          <StableGoogleAuthProvider clientId={googleClientId}>
            <LanguageProvider>
              <AuthProvider>
                <ToastProvider>
                  <div id="main-content">
                    {children}
                  </div>
                  <aside aria-label="Feedback and Support">
                    <FeedbackWidget />
                  </aside>
                </ToastProvider>
              </AuthProvider>
            </LanguageProvider>
          </StableGoogleAuthProvider>
        ) : (
          <LanguageProvider>
            <AuthProvider>
              <ToastProvider>
                <div id="main-content">
                  {children}
                </div>
                <aside aria-label="Feedback and Support">
                  <FeedbackWidget />
                </aside>
              </ToastProvider>
            </AuthProvider>
          </LanguageProvider>
        )}
        <Script
          id="sw-registration"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function() {
                    // SW registered
                  }, function() {
                    // SW registration failed — handled silently in production
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
