"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import type { PendingUser } from "@/types";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Check, X, Clock, Users, ShieldCheck } from "lucide-react";

export default function AdminPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.replace("/auth"); return; }
    if (!user.is_superuser) { router.replace("/rooms"); return; }

    api.admin.pendingUsers()
      .then(setPending)
      .catch(() => toast.error("Bekleyen kullanıcılar yüklenemedi"))
      .finally(() => setLoading(false));
  }, [user, hydrated, router]);

  async function handleApprove(u: PendingUser) {
    setActing(u.id);
    try {
      await api.admin.approve(u.id);
      setPending(prev => prev.filter(p => p.id !== u.id));
      toast.success(`"${u.username}" onaylandı`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    } finally {
      setActing(null);
    }
  }

  async function handleReject(u: PendingUser) {
    setActing(u.id);
    try {
      await api.admin.reject(u.id);
      setPending(prev => prev.filter(p => p.id !== u.id));
      toast.success(`"${u.username}" reddedildi`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    } finally {
      setActing(null);
    }
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (!hydrated || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/rooms")}
              className="rounded-xl h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Odalar</span>
            </Button>
            <div className="w-px h-5 bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm sm:text-base">Yönetici Paneli</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Bekleyen Kayıtlar</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Sisteme katılmak isteyen kullanıcıları onaylayın veya reddedin
            </p>
          </div>
          {!loading && (
            <div className="shrink-0 flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 rounded-full px-3 py-1.5 text-sm font-semibold">
              <Clock className="w-3.5 h-3.5" />
              {pending.length} bekliyor
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold">Bekleyen kayıt yok</p>
            <p className="text-muted-foreground text-sm mt-1.5">
              Yeni bir kullanıcı kayıt olduğunda burada görünecek
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(u => (
              <div
                key={u.id}
                className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{u.username}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(u.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(u)}
                    disabled={acting === u.id}
                    className="rounded-xl gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm shadow-emerald-500/25 font-semibold h-8 px-3"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Onayla</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(u)}
                    disabled={acting === u.id}
                    className="rounded-xl gap-1.5 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold h-8 px-3"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reddet</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
