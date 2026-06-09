"use client";

import { useEffect, useState } from "react";

const AUTO_RELOAD_DELAY = 5000; // 5 seconds

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [countdown, setCountdown] = useState(Math.ceil(AUTO_RELOAD_DELAY / 1000));

  useEffect(() => {
    console.error("[Katalyst Global Error]", error);
  }, [error]);

  // Auto-reload after countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          reset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [reset]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "var(--background)", color: "var(--foreground)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--destructive)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "var(--muted-foreground)", marginBottom: "0.5rem", maxWidth: "360px", fontSize: "0.875rem" }}>
            {error.message || "A critical error occurred. The page will reload automatically."}
          </p>
          {countdown > 0 && (
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.75rem", marginBottom: "1rem" }}>
              Reloading in {countdown}s...
            </p>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = "/"}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--muted-foreground)",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
