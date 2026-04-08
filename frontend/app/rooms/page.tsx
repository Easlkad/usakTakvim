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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Key, LogOut, Users } from "lucide-react";

export default function RoomsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinKey, setJoinKey] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoom, setNewRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!user) { router.replace("/auth"); return; }
    api.rooms.list()
      .then(setRooms)
      .catch(() => toast.error("Odalar yüklenemedi"))
      .finally(() => setLoading(false));
  }, [user, router]);

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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-xl text-indigo-600">UsakTakvim</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {user.username}
              {user.is_superuser && <Badge variant="secondary" className="ml-2 text-xs">Admin</Badge>}
            </span>
            <Button variant="ghost" size="sm" onClick={() => { logout(); router.replace("/auth"); }}>
              <LogOut className="w-4 h-4 mr-1" /> Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Odalarım</h1>
            <p className="text-slate-500 mt-1">Takvimlerinize erişmek için bir oda seçin</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              <Key className="w-4 h-4 mr-2" /> Odaya Katıl
            </Button>
            {user.is_superuser && (
              <Button onClick={() => { setNewRoom(null); setCreateOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Oda Oluştur
              </Button>
            )}
          </div>
        </div>

        {/* Rooms Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-24">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">Henüz bir odanız yok</p>
            <p className="text-slate-400 text-sm mt-1">Bir oda anahtarı ile katılın</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <Card
                key={room.id}
                className="cursor-pointer hover:shadow-lg hover:border-indigo-200 transition-all duration-200 border border-slate-200 hover:-translate-y-0.5"
                onClick={() => router.push(`/rooms/${room.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                    {user.is_superuser && room.room_key && (
                      <code className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded">
                        {room.room_key}
                      </code>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3">{room.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-slate-400 text-sm">
                    <Users className="w-3.5 h-3.5" />
                    <span>Odaya gir</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Join Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odaya Katıl</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJoin} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Oda Anahtarı</Label>
              <Input
                value={joinKey}
                onChange={e => setJoinKey(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxx"
                required
              />
            </div>
            <Button type="submit" className="w-full">Katıl</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setNewRoom(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Oda Oluştur</DialogTitle>
          </DialogHeader>
          {newRoom ? (
            <div className="space-y-4 mt-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-medium mb-1">"{newRoom.name}" oluşturuldu!</p>
                <p className="text-sm text-green-700 mb-3">Oda anahtarını paylaşın:</p>
                <code className="bg-green-100 text-green-900 font-mono text-lg px-4 py-2 rounded-md block">
                  {newRoom.room_key}
                </code>
              </div>
              <Button className="w-full" onClick={() => { setCreateOpen(false); setNewRoom(null); }}>
                Tamam
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Oda Adı</Label>
                <Input
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="Örn: Proje Takımı"
                  required
                />
              </div>
              <Button type="submit" className="w-full">Oluştur</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
