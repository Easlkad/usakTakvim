"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Notification } from "@/types";
import { Bell, Calendar, CheckCheck } from "lucide-react";

export function NotificationPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const load = useCallback(async () => {
    try {
      setNotifications(await api.notifications.list());
    } catch {}
  }, []);

  // Load on mount and refresh every 60 seconds
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleOpen() {
    setOpen(true);
    // Mark all read immediately on open
    if (unreadCount > 0) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      api.notifications.markAllRead().catch(() => {});
    }
  }

  function handleClick(n: Notification) {
    setOpen(false);
    router.push(`/rooms/${n.room_id}`);
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return "Az önce";
    if (diffMin < 60) return `${diffMin} dk önce`;
    if (diffHr < 24) return `${diffHr} sa önce`;
    if (diffDay < 7) return `${diffDay} gün önce`;
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Bildirimler"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[400px] flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0 flex-row items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4 text-primary" />
              Bildirimler
            </SheetTitle>
            {notifications.some(n => n.read) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 rounded-lg"
                onClick={async () => {
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  await api.notifications.markAllRead().catch(() => {});
                }}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tümünü okundu işaretle
              </Button>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Bildirim yok</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Odalarda yeni etkinlikler oluşturulduğunda burada görünecek
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-5 py-4 hover:bg-muted/50 transition-colors ${
                      !n.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      !n.read
                        ? "bg-violet-100 dark:bg-violet-950/60"
                        : "bg-muted"
                    }`}>
                      <Calendar className={`w-4 h-4 ${!n.read ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-primary/70 font-medium truncate">{n.room_name}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{fmtTime(n.created_at)}</span>
                      </div>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-2" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
