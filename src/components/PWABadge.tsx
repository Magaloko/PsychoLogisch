import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudOff, Download, RefreshCw, Wifi, WifiOff, X } from 'lucide-react';

// Lazy-Import des virtuellen Moduls von vite-plugin-pwa,
// damit der Code auch ohne PWA-Plugin (z.B. lokal ohne Build) nicht crasht.
type RegisterSWFn = (opts: {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (r?: ServiceWorkerRegistration) => void;
}) => (force?: boolean) => Promise<void>;

export default function PWABadge() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((force?: boolean) => Promise<void>) | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Online/offline status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    // Dynamic import: works only with vite-plugin-pwa
    import('virtual:pwa-register' as string)
      .then((mod: { registerSW: RegisterSWFn }) => {
        const update = mod.registerSW({
          onNeedRefresh: () => setNeedRefresh(true),
          onOfflineReady: () => {
            setOfflineReady(true);
            setTimeout(() => setOfflineReady(false), 6000);
          },
        });
        setUpdateSW(() => update);
      })
      .catch(() => {
        // PWA plugin not available — silently ignore
      });
  }, []);

  return (
    <>
      {/* Offline indicator (always visible when offline) */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-md dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
            title="Du bist offline – die App funktioniert weiter mit gespeicherten Daten"
          >
            <WifiOff className="h-3.5 w-3.5" />
            Offline-Modus
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline-ready toast */}
      <AnimatePresence>
        {offlineReady && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 sm:bottom-6"
          >
            <CloudOff className="h-4 w-4" />
            App ist offline-bereit ✓
            <button
              onClick={() => setOfflineReady(false)}
              className="ml-1 rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/25"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update available prompt */}
      <AnimatePresence>
        {needRefresh && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-white p-3 shadow-xl dark:border-indigo-500/30 dark:bg-slate-800 sm:bottom-6"
          >
            <div className="flex items-center gap-2 text-sm">
              <Download className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Neue Version verfügbar
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => updateSW?.(true)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <RefreshCw className="h-3.5 w-3.5 inline-block mr-1" />
                Aktualisieren
              </button>
              <button
                onClick={() => setNeedRefresh(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Helper für andere Komponenten, die den Online-Status abrufen wollen
export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
};

// Required to silence unused-import warning
export { Wifi };
