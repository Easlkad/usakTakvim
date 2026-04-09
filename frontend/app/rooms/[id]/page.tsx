"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { RoomCalendar } from "@/components/room-calendar";
import { ChatDrawer } from "@/components/chat-drawer";
import { MembersSheet } from "@/components/members-sheet";
import { NotificationPanel } from "@/components/notification-panel";
import type { ChatMessage } from "@/types";
import { ArrowLeft, Plus, Check, X, Clock, Trash2, User, Key, Copy, Calendar, ThumbsUp, Users } from "lucide-react";

export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [membersOpen, setMembersOpen] = useState(false);
  const [noNoteOpen, setNoNoteOpen] = useState(false);
  const [noNote, setNoNote] = useState("");
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

    Promise.all([api.rooms.get(roomId), api.events.list(roomId), api.chat.messages(roomId)])
      .then(([r, evs, msgs]) => { setRoom(r); setEvents(evs); setChatMessages(msgs); })
      .catch(() => toast.error("Oda yüklenemedi"));

    const ws = new WebSocket(api.wsUrl(roomId));
    wsRef.current = ws;
    ws.onerror = () => toast.error("Bağlantı hatası, lütfen sayfayı yenileyin");
    ws.onmessage = (e) => {
      const msg: WSMessage = JSON.parse(e.data);
      if (msg.type === "event_created") {
        setEvents(prev => [...prev, msg.payload]);
      } else if (msg.type === "event_deleted") {
        setEvents(prev => prev.filter(ev => ev.id !== msg.payload.event_id));
        setSelectedEvent(prev => prev?.id === msg.payload.event_id ? null : prev);
      } else if (msg.type === "chat_message") {
        setChatMessages(prev => [...prev, msg.payload]);
        if (!chatOpen) setUnreadCount(prev => prev + 1);
      } else if (msg.type === "alternative_voted") {
        const { response_id, vote_count, voter_id, voted } = msg.payload;
        const applyVote = (responses: import("@/types").Response[]) =>
          responses.map(r => r.id !== response_id ? r : {
            ...r,
            vote_count,
            my_vote: voter_id === user?.id ? voted : r.my_vote,
          });
        setEvents(prev => prev.map(ev => ({ ...ev, responses: applyVote(ev.responses) })));
        setSelectedEvent(prev => prev ? { ...prev, responses: applyVote(prev.responses) } : prev);
      } else if (msg.type === "member_removed") {
        if (msg.payload.user_id === user?.id) {
          toast.error("Odadan çıkarıldınız");
          router.replace("/rooms");
        }
      } else if (msg.type === "member_requested") {
        if (user?.is_superuser || room?.created_by === user?.id) {
          toast.info(`"${msg.payload.username}" odaya katılmak istiyor`, { duration: 5000 });
        }
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

  async function respond(type: "yes" | "no", note = "") {
    if (!selectedEvent) return;
    setSubmitting(true);
    try {
      await api.events.respond(roomId, selectedEvent.id, {
        response_type: type,
        ...(note ? { note } : {}),
      });
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

  async function handleVote(responseId: string) {
    if (!selectedEvent) return;
    try {
      await api.events.vote(roomId, selectedEvent.id, responseId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    }
  }

  function sendChatMessage(content: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error("Bağlantı yok, lütfen sayfayı yenileyin");
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "chat_message", content }));
  }

  function myResponse(ev: Event): Response | undefined {
    return ev.responses.find(r => r.user_id === user?.id);
  }

  const responseCount = (ev: Event, type: string) => ev.responses.filter(r => r.response_type === type).length;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (!hydrated) return null;
  if (!user) return null;

  const canSeeKey = room?.room_key && (user.is_superuser || room.created_by === user.id);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/rooms")}
              className="shrink-0 rounded-xl h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Odalar</span>
            </Button>
            <div className="w-px h-5 bg-border hidden sm:block" />
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-md flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-sm sm:text-base truncate">{room?.name ?? "..."}</span>
              {canSeeKey && (
                <button
                  onClick={() => setShowKey(v => !v)}
                  className={`shrink-0 flex items-center gap-1 text-xs transition-colors rounded-md px-1.5 py-0.5 ${showKey ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"}`}
                  title="Oda anahtarını göster"
                >
                  <Key className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <NotificationPanel />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMembersOpen(true)}
              className="rounded-xl h-8 gap-1.5 px-2 sm:px-2.5 text-muted-foreground hover:text-foreground"
              title="Üyeler"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">Üyeler</span>
            </Button>
            <Button
              size="sm"
              onClick={() => { setCreateSlot(null); setCreateOpen(true); }}
              className="rounded-xl gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 shadow-md shadow-violet-500/20 h-8 text-xs sm:text-sm px-2.5 sm:px-3.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-semibold">Etkinlik Ekle</span>
            </Button>
          </div>
        </div>

        {/* Room key bar */}
        {canSeeKey && showKey && (
          <div className="bg-primary/8 border-t border-primary/15 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs text-primary/80 font-medium">Oda anahtarı:</span>
              <code className="font-mono text-sm text-primary bg-primary/10 px-2.5 py-0.5 rounded-md font-bold">{room?.room_key}</code>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(room?.room_key ?? ""); toast.success("Kopyalandı"); }}
              className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary font-medium transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Kopyala
            </button>
          </div>
        )}
      </header>

      {/* Legend */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 pt-3 pb-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {[
          { color: "bg-violet-500", label: "Yanıtlanmadı" },
          { color: "bg-emerald-500", label: "Katılıyorum" },
          { color: "bg-rose-500", label: "Katılamıyorum" },
          { color: "bg-amber-400", label: "Alternatif önerdim" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 bg-card border border-border rounded-full px-2.5 py-1">
            <span className={`w-2 h-2 rounded-full ${color} inline-block`} />
            {label}
          </span>
        ))}
      </div>

      {/* Calendar */}
      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 py-3 w-full">
        <div
          className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden calendar-container"
          style={{ height: isMobile ? "calc(100vh - 210px)" : "calc(100vh - 190px)" }}
        >
          <RoomCalendar
            events={events}
            isMobile={isMobile}
            userId={user?.id}
            onSelectEvent={setSelectedEvent}
            onSelectSlot={(slot) => { setCreateSlot(slot); setCreateOpen(true); }}
          />
        </div>
      </main>

      {/* Event Detail Sheet */}
      <Sheet open={!!selectedEvent} onOpenChange={v => !v && setSelectedEvent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[560px] flex flex-col gap-0 p-0">
          {selectedEvent && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <SheetTitle className="text-xl leading-tight">{selectedEvent.title}</SheetTitle>
                  {(user.is_superuser || selectedEvent.created_by === user.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-xl h-8 w-8 p-0"
                      onClick={() => handleDelete(selectedEvent.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Event info */}
                <div className="bg-muted/60 rounded-xl p-4 space-y-2.5 text-sm">
                  <div className="flex items-start gap-2.5 text-foreground/80">
                    <Clock className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                    <span className="leading-relaxed">{fmtDate(selectedEvent.start_time)} – {fmtDate(selectedEvent.end_time)}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-foreground/80">
                    <User className="w-4 h-4 shrink-0 text-primary" />
                    <span>{selectedEvent.creator_name}</span>
                  </div>
                  {selectedEvent.description && (
                    <p className="text-foreground/70 pt-0.5 leading-relaxed">{selectedEvent.description}</p>
                  )}
                </div>

                {/* Response Buttons */}
                <div>
                  <p className="text-sm font-semibold mb-3">Yanıtınız:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      className={`rounded-xl gap-1.5 font-semibold transition-all ${
                        myResponse(selectedEvent)?.response_type === "yes"
                          ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25 border-0"
                          : "border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 bg-transparent"
                      }`}
                      onClick={() => respond("yes")}
                      disabled={submitting}
                    >
                      <Check className="w-3.5 h-3.5" /> Katılıyorum
                    </Button>
                    <Button
                      size="sm"
                      className={`rounded-xl gap-1.5 font-semibold transition-all ${
                        myResponse(selectedEvent)?.response_type === "no"
                          ? "bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/25 border-0"
                          : "border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 bg-transparent"
                      }`}
                      onClick={() => { setNoNote(myResponse(selectedEvent)?.note ?? ""); setNoNoteOpen(true); }}
                      disabled={submitting}
                    >
                      <X className="w-3.5 h-3.5" /> Katılamıyorum
                    </Button>
                    <Button
                      size="sm"
                      className={`rounded-xl gap-1.5 font-semibold transition-all ${
                        myResponse(selectedEvent)?.response_type === "alternative"
                          ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25 border-0"
                          : "border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 bg-transparent"
                      }`}
                      onClick={() => setAltOpen(true)}
                      disabled={submitting}
                    >
                      <Clock className="w-3.5 h-3.5" /> Öneri
                    </Button>
                  </div>
                </div>

                {/* Response summary badges */}
                <div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <p className="text-sm font-semibold">Yanıtlar</p>
                    <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-0 hover:bg-emerald-100 rounded-full px-2.5">
                      {responseCount(selectedEvent, "yes")} evet
                    </Badge>
                    <Badge className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-0 hover:bg-rose-100 rounded-full px-2.5">
                      {responseCount(selectedEvent, "no")} hayır
                    </Badge>
                    <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-0 hover:bg-amber-100 rounded-full px-2.5">
                      {responseCount(selectedEvent, "alternative")} öneri
                    </Badge>
                  </div>

                  {selectedEvent.responses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-5 bg-muted/40 rounded-xl">
                      Henüz yanıt yok
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedEvent.responses.map(r => (
                        <div key={r.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/50 border border-border/50">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            r.response_type === "yes" ? "bg-emerald-100 dark:bg-emerald-900" :
                            r.response_type === "no" ? "bg-rose-100 dark:bg-rose-900" : "bg-amber-100 dark:bg-amber-900"
                          }`}>
                            {r.response_type === "yes" && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                            {r.response_type === "no" && <X className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                            {r.response_type === "alternative" && <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{r.username}</p>
                            {r.response_type === "alternative" && r.alt_start_time && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                                {fmtDate(r.alt_start_time)} – {fmtDate(r.alt_end_time!)}
                              </p>
                            )}
                            {r.note && (
                              <p className={`text-xs mt-1 italic ${
                                r.response_type === "no"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground"
                              }`}>"{r.note}"</p>
                            )}
                          </div>
                          {r.response_type === "alternative" && r.user_id !== user.id && (
                            <button
                              onClick={() => handleVote(r.id)}
                              title={r.my_vote ? "Desteği geri al" : "Bu öneriyi destekle"}
                              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                r.my_vote
                                  ? "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300"
                                  : "bg-muted text-muted-foreground hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600"
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              {r.vote_count > 0 && <span>{r.vote_count}</span>}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* "No" explanation dialog */}
      <Dialog open={noNoteOpen} onOpenChange={v => { setNoNoteOpen(v); if (!v) setNoNote(""); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Katılamıyorum</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Açıklama <span className="text-muted-foreground font-normal">(isteğe bağlı)</span>
              </Label>
              <Input
                value={noNote}
                onChange={e => setNoNote(e.target.value)}
                placeholder="Neden katılamıyorsunuz?"
                className="h-11 rounded-xl"
                maxLength={300}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={() => { setNoNoteOpen(false); setNoNote(""); }}
              >
                İptal
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border-0 font-semibold"
                disabled={submitting}
                onClick={async () => {
                  await respond("no", noNote);
                  setNoNoteOpen(false);
                  setNoNote("");
                }}
              >
                Gönder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) setCreateSlot(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Yeni Etkinlik</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-1">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Başlık</Label>
              <Input name="title" required placeholder="Etkinlik adı" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Açıklama <span className="text-muted-foreground font-normal">(isteğe bağlı)</span></Label>
              <Input name="description" placeholder="Detaylar..." className="h-11 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Başlangıç</Label>
                <Input
                  name="start_time"
                  type="datetime-local"
                  required
                  defaultValue={createSlot ? format(createSlot.start, "yyyy-MM-dd'T'HH:mm") : ""}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Bitiş</Label>
                <Input
                  name="end_time"
                  type="datetime-local"
                  required
                  defaultValue={createSlot ? format(createSlot.end, "yyyy-MM-dd'T'HH:mm") : ""}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white border-0 font-semibold shadow-md shadow-violet-500/25"
              disabled={submitting}
            >
              {submitting ? "Oluşturuluyor..." : "Etkinlik Oluştur"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Members */}
      {room && (
        <MembersSheet
          open={membersOpen}
          onOpenChange={setMembersOpen}
          roomId={roomId}
          currentUser={user}
          roomOwnerId={room.created_by}
          isMobile={isMobile}
        />
      )}

      {/* Chat */}
      <ChatDrawer
        open={chatOpen}
        onOpenChange={(v) => { setChatOpen(v); if (v) setUnreadCount(0); }}
        messages={chatMessages}
        currentUser={user}
        onSend={sendChatMessage}
        unreadCount={unreadCount}
        isMobile={isMobile}
      />

      {/* Alternative Proposal Dialog */}
      <Dialog open={altOpen} onOpenChange={setAltOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Öneri Gönder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAlternative} className="space-y-4 mt-1">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Notunuz / Alternatif öneriniz</Label>
              <Input name="note" placeholder="Örn: Farklı bir aktivite önerim var..." className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-muted-foreground">Alternatif zaman <span className="font-normal">(isteğe bağlı)</span></Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Başlangıç</Label>
                  <Input name="alt_start" type="datetime-local" className="h-10 rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Bitiş</Label>
                  <Input name="alt_end" type="datetime-local" className="h-10 rounded-xl text-sm" />
                </div>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 font-semibold shadow-md shadow-amber-500/25"
              disabled={submitting}
            >
              {submitting ? "Gönderiliyor..." : "Öneri Gönder"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
