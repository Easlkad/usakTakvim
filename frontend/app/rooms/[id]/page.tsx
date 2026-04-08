"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { tr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import type { Event, Response, WSMessage, Room } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Check, X, Clock, Trash2, User, Key, Copy } from "lucide-react";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { tr },
});

const messages = {
  today: "Bugün",
  previous: "Geri",
  next: "İleri",
  month: "Ay",
  week: "Hafta",
  day: "Gün",
  agenda: "Ajanda",
  date: "Tarih",
  time: "Saat",
  event: "Etkinlik",
  noEventsInRange: "Bu aralıkta etkinlik yok",
};

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = use(params);
  const { user, hydrated } = useAuth();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlot, setCreateSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [altOpen, setAltOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.replace("/auth"); return; }

    Promise.all([api.rooms.get(roomId), api.events.list(roomId)])
      .then(([r, evs]) => { setRoom(r); setEvents(evs); })
      .catch(() => toast.error("Oda yüklenemedi"));

    const ws = new WebSocket(api.wsUrl(roomId));
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg: WSMessage = JSON.parse(e.data);
      if (msg.type === "event_created") {
        setEvents(prev => [...prev, msg.payload]);
      } else if (msg.type === "event_deleted") {
        setEvents(prev => prev.filter(ev => ev.id !== msg.payload.event_id));
        setSelectedEvent(prev => prev?.id === msg.payload.event_id ? null : prev);
      } else if (msg.type === "response_updated") {
        const r = msg.payload;
        setEvents(prev => prev.map(ev => {
          if (ev.id !== r.event_id) return ev;
          const existing = ev.responses.findIndex(res => res.user_id === r.user_id);
          const responses = existing >= 0
            ? ev.responses.map((res, i) => i === existing ? r : res)
            : [...ev.responses, r];
          return { ...ev, responses };
        }));
        setSelectedEvent(prev => {
          if (!prev || prev.id !== r.event_id) return prev;
          const existing = prev.responses.findIndex(res => res.user_id === r.user_id);
          const responses = existing >= 0
            ? prev.responses.map((res, i) => i === existing ? r : res)
            : [...prev.responses, r];
          return { ...prev, responses };
        });
      }
    };
    return () => ws.close();
  }, [roomId, user, hydrated, router]);

  const calendarEvents = events.map(ev => ({
    id: ev.id,
    title: ev.title,
    start: new Date(ev.start_time),
    end: new Date(ev.end_time),
    resource: ev,
  }));

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await api.events.create(roomId, {
        title: fd.get("title") as string,
        description: fd.get("description") as string,
        start_time: new Date(fd.get("start_time") as string).toISOString(),
        end_time: new Date(fd.get("end_time") as string).toISOString(),
      });
      setCreateOpen(false);
      setCreateSlot(null);
      toast.success("Etkinlik oluşturuldu");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    } finally {
      setSubmitting(false);
    }
  }

  async function respond(type: "yes" | "no") {
    if (!selectedEvent) return;
    setSubmitting(true);
    try {
      await api.events.respond(roomId, selectedEvent.id, { response_type: type });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAlternative(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedEvent) return;
    const fd = new FormData(e.currentTarget);
    const altStart = fd.get("alt_start") as string;
    const altEnd = fd.get("alt_end") as string;
    const note = fd.get("note") as string;

    setSubmitting(true);
    try {
      await api.events.respond(roomId, selectedEvent.id, {
        response_type: "alternative",
        ...(altStart && altEnd ? {
          alt_start_time: new Date(altStart).toISOString(),
          alt_end_time: new Date(altEnd).toISOString(),
        } : {}),
        note,
      });
      setAltOpen(false);
      toast.success("Öneri gönderildi");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(eventId: string) {
    try {
      await api.events.delete(roomId, eventId);
      setSelectedEvent(null);
      toast.success("Etkinlik silindi");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    }
  }

  function myResponse(ev: Event): Response | undefined {
    return ev.responses.find(r => r.user_id === user?.id);
  }

  const responseCount = (ev: Event, type: string) => ev.responses.filter(r => r.response_type === type).length;

  const eventStyleGetter = (event: typeof calendarEvents[0]) => {
    const ev: Event = event.resource;
    const me = myResponse(ev);
    const colors: Record<string, string> = { yes: "#22c55e", no: "#ef4444", alternative: "#f59e0b" };
    const bg = me ? colors[me.response_type] : "#4f46e5";
    return { style: { backgroundColor: bg, borderColor: bg, color: "white" } };
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (!hydrated) return null;
  if (!user) return null;

  const canSeeKey = room?.room_key && (user.is_superuser || room.created_by === user.id);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.push("/rooms")} className="shrink-0 px-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Odalar</span>
            </Button>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <span className="font-semibold text-slate-800 truncate text-sm sm:text-base">{room?.name ?? "..."}</span>
            {canSeeKey && (
              <button
                onClick={() => setShowKey(v => !v)}
                className="shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
                title="Oda anahtarını göster"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={() => { setCreateSlot(null); setCreateOpen(true); }} className="shrink-0 text-xs sm:text-sm px-2 sm:px-3">
            <Plus className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Etkinlik Ekle</span>
          </Button>
        </div>

        {/* Room key bar */}
        {canSeeKey && showKey && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-xs text-indigo-600">Oda anahtarı:</span>
              <code className="font-mono text-sm text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">{room?.room_key}</code>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(room?.room_key ?? ""); toast.success("Kopyalandı"); }}
              className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
            >
              <Copy className="w-3.5 h-3.5" /> Kopyala
            </button>
          </div>
        )}
      </header>

      {/* Legend */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-3 flex flex-wrap gap-2 sm:gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Yanıtlanmadı</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Katılıyorum</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Katılamıyorum</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Alternatif önerdim</span>
      </div>

      {/* Calendar */}
      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-3 w-full">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 sm:p-4 calendar-container" style={{ height: isMobile ? "calc(100vh - 200px)" : "calc(100vh - 180px)" }}>
          <BigCalendar
            localizer={localizer}
            events={calendarEvents}
            culture="tr"
            messages={messages}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(e) => setSelectedEvent(e.resource)}
            onSelectSlot={(slot) => { setCreateSlot({ start: slot.start, end: slot.end }); setCreateOpen(true); }}
            selectable
            defaultView={isMobile ? "agenda" : "month"}
            views={isMobile ? ["agenda", "day"] : ["month", "week", "day", "agenda"]}
            style={{ height: "100%" }}
          />
        </div>
      </main>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={v => !v && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <DialogTitle className="text-lg sm:text-xl leading-tight pr-2">{selectedEvent.title}</DialogTitle>
                  {(user.is_superuser || selectedEvent.created_by === user.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => handleDelete(selectedEvent.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-slate-600">
                    <Clock className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5" />
                    <span>{fmtDate(selectedEvent.start_time)} – {fmtDate(selectedEvent.end_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>{selectedEvent.creator_name}</span>
                  </div>
                  {selectedEvent.description && (
                    <p className="text-slate-700 pt-1">{selectedEvent.description}</p>
                  )}
                </div>

                {/* Response Buttons */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Yanıtınız:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={myResponse(selectedEvent)?.response_type === "yes" ? "default" : "outline"}
                      className={myResponse(selectedEvent)?.response_type === "yes" ? "bg-green-500 hover:bg-green-600 border-green-500" : "border-green-200 text-green-700 hover:bg-green-50"}
                      onClick={() => respond("yes")}
                      disabled={submitting}
                    >
                      <Check className="w-4 h-4 mr-1" /> Katılıyorum
                    </Button>
                    <Button
                      size="sm"
                      variant={myResponse(selectedEvent)?.response_type === "no" ? "default" : "outline"}
                      className={myResponse(selectedEvent)?.response_type === "no" ? "bg-red-500 hover:bg-red-600 border-red-500" : "border-red-200 text-red-700 hover:bg-red-50"}
                      onClick={() => respond("no")}
                      disabled={submitting}
                    >
                      <X className="w-4 h-4 mr-1" /> Katılamıyorum
                    </Button>
                    <Button
                      size="sm"
                      variant={myResponse(selectedEvent)?.response_type === "alternative" ? "default" : "outline"}
                      className={myResponse(selectedEvent)?.response_type === "alternative" ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : "border-amber-200 text-amber-700 hover:bg-amber-50"}
                      onClick={() => setAltOpen(true)}
                      disabled={submitting}
                    >
                      <Clock className="w-4 h-4 mr-1" /> Öneri
                    </Button>
                  </div>
                </div>

                {/* Response List */}
                <div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-sm font-medium text-slate-700">Yanıtlar</span>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{responseCount(selectedEvent, "yes")} evet</Badge>
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{responseCount(selectedEvent, "no")} hayır</Badge>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{responseCount(selectedEvent, "alternative")} öneri</Badge>
                  </div>

                  {selectedEvent.responses.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Henüz yanıt yok</p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {selectedEvent.responses.map(r => (
                        <div key={r.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            r.response_type === "yes" ? "bg-green-100" :
                            r.response_type === "no" ? "bg-red-100" : "bg-amber-100"
                          }`}>
                            {r.response_type === "yes" && <Check className="w-3.5 h-3.5 text-green-600" />}
                            {r.response_type === "no" && <X className="w-3.5 h-3.5 text-red-600" />}
                            {r.response_type === "alternative" && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{r.username}</p>
                            {r.response_type === "alternative" && r.alt_start_time && (
                              <p className="text-xs text-amber-700 mt-0.5">
                                {fmtDate(r.alt_start_time)} – {fmtDate(r.alt_end_time!)}
                              </p>
                            )}
                            {r.note && <p className="text-xs text-slate-500 mt-0.5 italic">"{r.note}"</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setCreateSlot(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Etkinlik</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Başlık</Label>
              <Input name="title" required placeholder="Etkinlik adı" />
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama (isteğe bağlı)</Label>
              <Input name="description" placeholder="Detaylar..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Başlangıç</Label>
                <Input
                  name="start_time"
                  type="datetime-local"
                  required
                  defaultValue={createSlot ? format(createSlot.start, "yyyy-MM-dd'T'HH:mm") : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bitiş</Label>
                <Input
                  name="end_time"
                  type="datetime-local"
                  required
                  defaultValue={createSlot ? format(createSlot.end, "yyyy-MM-dd'T'HH:mm") : ""}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Oluşturuluyor..." : "Etkinlik Oluştur"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alternative/Proposal Dialog */}
      <Dialog open={altOpen} onOpenChange={setAltOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Öneri Gönder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAlternative} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Notunuz / Alternatif öneriniz</Label>
              <Input name="note" placeholder="Örn: Farklı bir aktivite önerim var, bowling oynayalım..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-500 text-xs">Alternatif zaman önerisi (isteğe bağlı)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">Başlangıç</Label>
                  <Input name="alt_start" type="datetime-local" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">Bitiş</Label>
                  <Input name="alt_end" type="datetime-local" />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Gönderiliyor..." : "Öneri Gönder"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
