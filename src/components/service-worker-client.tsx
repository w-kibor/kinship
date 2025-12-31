"use client";

import { useEffect } from "react";

const SW_PATH = "/sw.js";

export function ServiceWorkerClient() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_PATH);
        await registration.update();
      } catch (error) {
        console.warn("Service worker registration failed", error);
      }
    };

    register();

    const flushQueue = () => {
      navigator.serviceWorker.controller?.postMessage({
        type: "KINSHIP_FLUSH_QUEUE",
      });
    };

    window.addEventListener("online", flushQueue);

    return () => {
      window.removeEventListener("online", flushQueue);
    };
  }, []);

  return null;
}
