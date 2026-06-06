"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary that replaces the root layout if it throws. Must render
 * its own <html>/<body>; uses inline styles since app providers/CSS may not be
 * available at this level.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1
            style={{ fontSize: "1.25rem", fontWeight: 600, color: "#762651" }}
          >
            TSS Planner
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#4b5563" }}>
            A server error occurred. Please try again.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "0.25rem",
                fontSize: "0.75rem",
                color: "#9ca3af",
              }}
            >
              Ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#762651",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
