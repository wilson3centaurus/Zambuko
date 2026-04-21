"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { setupConnectivitySync } from "@zambuko/offline";
import { createClient } from "@zambuko/database/client";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Set up offline sync when user is authenticated
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const cleanup = setupConnectivitySync(supabase, user.id);
        return cleanup;
      }
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
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
  );
}
