"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { setupConnectivitySync } from "@zambuko/offline";
import { createClient } from "@zambuko/database/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error: unknown) => {
              // Don't retry if offline and not cached
              if (!navigator.onLine) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setupConnectivitySync(supabase, data.user.id);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "rounded-2xl font-sans text-sm shadow-lg",
            success: "bg-green-50 text-green-900 border border-green-200",
            error: "bg-red-50 text-red-900 border border-red-200",
          },
        }}
      />
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
