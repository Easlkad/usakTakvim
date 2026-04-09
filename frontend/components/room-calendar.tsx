"use client";

import { useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { tr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type { Event, Response } from "@/types";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { tr },
});

const calMessages = {
  today: "Bugün",
  previous: "‹",
  next: "›",
  month: "Ay",
  week: "Hafta",
  day: "Gün",
  agenda: "Ajanda",
  date: "Tarih",
  time: "Saat",
  event: "Etkinlik",
  noEventsInRange: "Bu aralıkta etkinlik yok",
};

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Event;
}

interface Props {
  events: Event[];
  isMobile: boolean;
  userId: string | undefined;
  onSelectEvent: (ev: Event) => void;
  onSelectSlot: (slot: { start: Date; end: Date }) => void;
}

export function RoomCalendar({ events, isMobile, userId, onSelectEvent, onSelectSlot }: Props) {
  const calendarEvents: CalEvent[] = useMemo(() => events.filter(ev => ev?.id && ev?.title && ev?.start_time && ev?.end_time).map(ev => ({
    id: ev.id,
    title: ev.title,
    start: new Date(ev.start_time),
    end: new Date(ev.end_time),
    resource: ev,
  })), [events]);

  const eventStyleGetter = useMemo(() => (event: CalEvent) => {
    const ev: Event = event.resource;
    const me: Response | undefined = ev?.responses?.find(r => r.user_id === userId);
    const colors: Record<string, string> = {
      yes: "#10b981",
      no: "#f43f5e",
      alternative: "#f59e0b",
    };
    const bg = me ? colors[me.response_type] : "#7c3aed";
    return { style: { backgroundColor: bg, borderColor: bg, color: "white" } };
  }, [events, userId]);

  return (
    <Calendar
      key={isMobile ? "mobile" : "desktop"}
      localizer={localizer}
      events={calendarEvents}
      culture="tr"
      messages={calMessages}
      eventPropGetter={eventStyleGetter}
      onSelectEvent={(e: CalEvent) => onSelectEvent(e.resource)}
      onSelectSlot={onSelectSlot}
      selectable
      defaultView={isMobile ? "agenda" : "month"}
      views={isMobile ? ["agenda", "day"] : ["month", "week", "day", "agenda"]}
      style={{ height: "100%" }}
    />
  );
}
