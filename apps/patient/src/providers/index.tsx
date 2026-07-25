"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@zambuko/ui";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,          // 1 minute
        gcTime: 5 * 60 * 1000,         // 5 minutes
        retry: (failureCount, error) => {
          // Don't retry on offline
          if (!navigator.onLine) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  useEffect(() => {
    const enabled = localStorage.getItem("hutano-low-bandwidth") === "true";
    document.documentElement.classList.toggle("low-bandwidth", enabled);
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <NetworkStatus />
        <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: { fontSize: "14px" },
        }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function NetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div role="status" className="fixed inset-x-3 top-3 z-[100] mx-auto max-w-md rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950 shadow-lg">
      You’re offline. Emergency requests, bookings, payments, and pharmacy actions require a connection.
    </div>
  );
}
