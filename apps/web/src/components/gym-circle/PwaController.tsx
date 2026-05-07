"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Download, WifiOff, X } from "lucide-react";
import { useGymCircleServices } from "@gym-circle/core/hooks";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaControllerProps = {
  userId?: string;
};

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = `${base64}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(normalized);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function getPushKeys(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  };
}

export function PwaController({ userId }: PwaControllerProps) {
  const services = useGymCircleServices();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
    );
  });
  const [online, setOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine,
  );
  const [dismissed, setDismissed] = useState(false);
  const [notificationState, setNotificationState] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* PWA segue funcionando sem cache offline. */
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const canAskNotifications = useMemo(
    () => notificationState === "default" && Boolean(vapidPublicKey),
    [notificationState, vapidPublicKey],
  );

  const showPrompt = !dismissed && !isInstalled && Boolean(installPrompt);
  const showNotifications = !dismissed && isInstalled && canAskNotifications && Boolean(userId);
  const showOffline = !online;

  const install = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
    setDismissed(true);
  }, [installPrompt]);

  const enableNotifications = useCallback(async () => {
    if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
    const keys = getPushKeys(subscription);
    if (!keys.endpoint || !keys.p256dh || !keys.auth) return;
    if (!userId) return;
    await services.push.save(userId, {
      endpoint: keys.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: navigator.userAgent,
    });
    setDismissed(true);
  }, [services.push, userId, vapidPublicKey]);

  if (!showPrompt && !showNotifications && !showOffline) return null;

  return (
    <div className="pointer-events-none absolute inset-x-3 top-[calc(var(--gc-safe-top)+0.75rem)] z-[70] flex justify-center">
      <div className="pointer-events-auto flex max-w-[360px] items-center gap-2 rounded-full border border-white/[0.1] bg-black/78 p-1.5 text-white shadow-[0_18px_48px_rgba(0,0,0,0.56)] backdrop-blur-2xl">
        {showOffline ? (
          <>
            <div className="grid size-9 place-items-center rounded-full bg-white/[0.08] text-white/62">
              <WifiOff size={16} />
            </div>
            <span className="px-1 text-[12px] font-black text-white/72">Modo offline</span>
          </>
        ) : showPrompt ? (
          <button
            className="gc-pressable flex h-9 items-center gap-2 rounded-full bg-[var(--gc-brand)] px-3 text-[12px] font-black text-black"
            onClick={install}
            type="button"
          >
            <Download size={15} />
            Instalar app
          </button>
        ) : (
          <button
            className="gc-pressable flex h-9 items-center gap-2 rounded-full bg-[var(--gc-brand)] px-3 text-[12px] font-black text-black"
            onClick={enableNotifications}
            type="button"
          >
            <Bell size={15} />
            Ativar alertas
          </button>
        )}
        {!showOffline ? (
          <button
            aria-label="Ocultar"
            className="gc-pressable grid size-9 place-items-center rounded-full bg-white/[0.08] text-white/58"
            onClick={() => setDismissed(true)}
            type="button"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
