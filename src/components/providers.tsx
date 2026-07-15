// src/components/providers.tsx
"use client";
import { ThemeProvider } from "next-themes";
import * as React from "react";
import { ZoomLock } from "@/components/zoom-lock";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <ZoomLock />
      {children}
    </ThemeProvider>
  );
}
