"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import type { Room } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Calendar, Plus, Key, LogOut, ArrowRight, Hash } from "lucide-react";

const CARD_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-500",
  "from-indigo-500 to-violet-600",
  "from-fuchsia-500 to-pink-600",
  "from-sky-500 to-cyan-600",
];

function getRoomGradient(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return CARD_GRADIENTS[Math.abs(h) % CARD_GRADIENTS.length];
}

export default function RoomsPage() {
  const { user, logout, hydrated } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinKey, setJoinKey] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoom, setNewRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.replace("/auth"); return; }
    api.rooms.list()
      .then(setRooms)
      .catch(() => toast.error("Odalar yüklenemedi"))
      .finally(() => setLoading(false));
  }, [user, hydrated, router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const room = await api.rooms.join(joinKey.trim());
      setRooms(prev => prev.find(r => r.id === room.id) ? prev : [room, ...prev]);
      setJoinKey("");
      setJoinOpen(false);
      toast.success(`"${room.name}" odasına katıldınız`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Geçersiz oda anahtarı");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const room = await api.rooms.create(newRoomName.trim());
      setRooms(prev => [room, ...prev]);
      setNewRoom(room);
      setNewRoomName("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Oda oluşturulamadı");
    }
  }

  if (!hydrated) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg sm:text-xl tracking-tight">UsakTakvim</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{user.username}</span>
              {user.is_superuser && (
                <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 text-xs px-2 py-0">
                  Admin
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { logout(); router.replace("/auth"); }}
              className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Odalarım</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Takvimlerinize erişmek için bir oda seçin
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setJoinOpen(true)}
              className="rounded-xl gap-1.5 border-border hover:border-primary/50 hover:text-primary h-9"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Odaya Katıl</span>
            </Button>
            {user.is_superuser && (
              <Button
                size="sm"
                onClick={() => { setNewRoom(null); setCreateOpen(true); }}
                className="rounded-xl gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-md shadow-violet-500/25 h-9"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-medium">Oda Oluştur</span>
              </Button>
            )}
          </div>
        </div>

        {/* Rooms Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-5">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">Henüz bir odanız yok</p>
            <p className="text-muted-foreground text-sm mt-1.5">Bir oda anahtarı ile katılın veya yeni bir oda oluşturun</p>
            <Button
              variant="outline"
              className="mt-6 rounded-xl gap-2"
              onClick={() => setJoinOpen(true)}
            >
              <Key className="w-4 h-4" />
              Odaya Katıl
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => {
              const gradient = getRoomGradient(room.id);
              return (
                <button
                  key={room.id}
                  onClick={() => router.push(`/rooms/${room.id}`)}
                  className="group text-left bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 hover:-translate-y-0.5 p-5 flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-11 h-11 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-md`}>
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    {user.is_superuser && room.room_key && (
                      <div className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1">
                        <Hash className="w-3 h-3 text-muted-foreground" />
                        <code className="text-xs text-muted-foreground font-mono">{room.room_key}</code>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors leading-tight">
                      {room.name}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Takvimi görüntüle</span>
                    <div className="w-6 h-6 rounded-full bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 flex items-center justify-center">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Join Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">Odaya Katıl</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJoin} className="space-y-5 mt-1">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Oda Anahtarı</Label>
              <Input
                value={joinKey}
                onChange={e => setJoinKey(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxx"
                required
                className="h-11 rounded-xl font-mono"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 font-semibold shadow-md shadow-violet-500/25">
              Katıl
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setNewRoom(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">Yeni Oda Oluştur</DialogTitle>
          </DialogHeader>
          {newRoom ? (
            <div className="space-y-4 mt-1">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 text-center">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-emerald-900 dark:text-emerald-300 font-bold mb-1">"{newRoom.name}" oluşturuldu!</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4">Oda anahtarını paylaşın:</p>
                <code className="bg-white dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-mono text-base px-4 py-2.5 rounded-lg block border border-emerald-200 dark:border-emerald-800 shadow-sm">
                  {newRoom.room_key}
                </code>
              </div>
              <Button
                className="w-full h-11 rounded-xl font-semibold"
                onClick={() => { setCreateOpen(false); setNewRoom(null); }}
              >
                Tamam
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5 mt-1">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Oda Adı</Label>
                <Input
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="Örn: Proje Takımı"
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 font-semibold shadow-md shadow-violet-500/25">
                Oluştur
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
