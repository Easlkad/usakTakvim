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
import { ArrowLeft, Plus, Check, X, Clock, Trash2, User } from "lucide-react";

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
  const { user } = useAuth();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlot, setCreateSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [altOpen, setAltOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) { router.replace("/auth"); return; }

    Promise.all([api.rooms.get(roomId), api.events.list(roomId)])
      .then(([r, evs]) => { setRoom(r); setEvents(evs); })
      .catch(() => toast.error("Oda yüklenemedi"));

    // WebSocket
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
  }, [roomId, user, router]);

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
    setSubmitting(true);
    try {
      await api.events.respond(roomId, selectedEvent.id, {
        response_type: "alternative",
        alt_start_time: new Date(fd.get("alt_start") as string).toISOString(),
        alt_end_time: new Date(fd.get("alt_end") as string).toISOString(),
        note: fd.get("note") as string,
      });
      setAltOpen(false);
      toast.success("Alternatif önerildi");
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

  function toLocalInput(iso: string) {
    return new Date(iso).toISOString().slice(0, 16);
  }

  function myResponse(ev: Event): Response | undefined {
    return ev.responses.find(r => r.user_id === user?.id);
  }

  const responseCount = (ev: Event, type: string) => ev.responses.filter(r => r.response_type === type).length;

  const eventStyleGetter = (event: typeof calendarEvents[0]) => {
    const ev: Event = event.resource;
    const me = myResponse(ev);
    const colors: Record<string, string> = {
      yes: "#22c55e",
      no: "#ef4444",
      alternative: "#f59e0b",
    };
    const bg = me ? colors[me.response_type] : "#4f46e5";
    return { style: { backgroundColor: bg, borderColor: bg, color: "white" } };
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/rooms")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Odalar
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <span className="font-semibold text-slate-800">{room?.name ?? "..."}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{user.username}</span>
            <Button size="sm" onClick={() => { setCreateSlot(null); setCreateOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Etkinlik Ekle
            </Button>
          </div>
        </div>
      </header>

      {/* Legend */}
      <div className="max-w-7xl mx-auto px-4 pt-4 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Yanıtlanmadı</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Katılıyorum</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Katılamıyorum</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Alternatif önerdim</span>
      </div>

      {/* Calendar */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-4 w-full">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 calendar-container" style={{ height: "calc(100vh - 180px)" }}>
          <BigCalendar
            localizer={localizer}
            events={calendarEvents}
            culture="tr"
            messages={messages}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(e) => setSelectedEvent(e.resource)}
            onSelectSlot={(slot) => { setCreateSlot({ start: slot.start, end: slot.end }); setCreateOpen(true); }}
            selectable
            defaultView="month"
            views={["month", "week", "day", "agenda"]}
            style={{ height: "100%" }}
          />
        </div>
      </main>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={v => !v && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <DialogTitle className="text-xl leading-tight">{selectedEvent.title}</DialogTitle>
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
                {/* Info */}
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>{fmtDate(selectedEvent.start_time)} – {fmtDate(selectedEvent.end_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>{selectedEvent.creator_name} tarafından oluşturuldu</span>
                  </div>
                  {selectedEvent.description && (
                    <p className="text-slate-700 pt-1">{selectedEvent.description}</p>
                  )}
                </div>

                {/* Response Buttons */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Yanıtınız:</p>
                  <div className="flex gap-2">
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
                      <Clock className="w-4 h-4 mr-1" /> Alternatif
                    </Button>
                  </div>
                </div>

                {/* Response Summary */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-medium text-slate-700">Yanıtlar</span>
                    <div className="flex gap-2">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{responseCount(selectedEvent, "yes")} evet</Badge>
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{responseCount(selectedEvent, "no")} hayır</Badge>
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{responseCount(selectedEvent, "alternative")} alternatif</Badge>
                    </div>
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
                            {r.note && <p className="text-xs text-slate-500 mt-0.5">{r.note}</p>}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Etkinlik Oluştur</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">Başlık</Label>
              <Input id="ev-title" name="title" required placeholder="Etkinlik adı" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Açıklama (isteğe bağlı)</Label>
              <Input id="ev-desc" name="description" placeholder="Detaylar..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Başlangıç</Label>
                <Input
                  id="ev-start"
                  name="start_time"
                  type="datetime-local"
                  required
                  defaultValue={createSlot ? format(createSlot.start, "yyyy-MM-dd'T'HH:mm") : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">Bitiş</Label>
                <Input
                  id="ev-end"
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

      {/* Alternative Dialog */}
      <Dialog open={altOpen} onOpenChange={setAltOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alternatif Zaman Öner</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAlternative} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Önerilen Başlangıç</Label>
                <Input name="alt_start" type="datetime-local" required />
              </div>
              <div className="space-y-1.5">
                <Label>Önerilen Bitiş</Label>
                <Input name="alt_end" type="datetime-local" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Not (isteğe bağlı)</Label>
              <Input name="note" placeholder="Neden bu zamanı öneriyorsunuz?" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Gönderiliyor..." : "Alternatif Öner"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
