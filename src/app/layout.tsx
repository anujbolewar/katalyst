import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Katalyst",
  description: "The command center for humans supervising AI agents — Eisenhower matrix, Kanban, objectives, and agent deployment",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body className="antialiased font-sans" style={{ fontFamily: "var(--font-geist), 'Inter', system-ui, sans-serif" }}>
        <ThemeProvider>
          <LayoutShell>{children}</LayoutShell>
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "border-border bg-card text-card-foreground",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
