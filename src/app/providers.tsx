"use client";

import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function setupFocusListener() {
  focusManager.setEventListener((handleFocus) => {
    const listener = () => handleFocus();
    window.addEventListener("visibilitychange", listener, false);

    return () => {
      window.removeEventListener("visibilitychange", listener);
    };
  });
}

function setupOnlineListener() {
  const onOnline = () => onlineManager.setOnline(true);
  const onOffline = () => onlineManager.setOnline(false);

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 24 * 60 * 60 * 1000,
            retry: 1,
          },
          mutations: {
            networkMode: "offlineFirst",
            retry: 3,
          },
        },
      })
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    setupFocusListener();
    const cleanupOnline = setupOnlineListener();

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "kinship-cache-v1",
      throttleTime: 1000,
    });

    let unsubscribe: (() => void) | undefined;

    const startPersist = async () => {
      const maybeUnsubscribe = await persistQueryClient({
        queryClient,
        persister,
        maxAge: 24 * 60 * 60 * 1000,
      });

      if (typeof maybeUnsubscribe === "function") {
        unsubscribe = maybeUnsubscribe;
      }
    };

    startPersist();

    return () => {
      cleanupOnline();
      unsubscribe?.();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
