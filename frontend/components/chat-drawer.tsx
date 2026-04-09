"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage, User } from "@/types";
import { Send, MessageCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  messages: ChatMessage[];
  currentUser: User;
  onSend: (content: string) => void;
  unreadCount: number;
  isMobile: boolean;
}

export function ChatDrawer({ open, onOpenChange, messages, currentUser, onSend, unreadCount, isMobile }: Props) {
  const [input, setInput] = useState("");
  const [sheetHeight, setSheetHeight] = useState("75dvh");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track visual viewport so the sheet shrinks correctly when the keyboard opens on mobile
  useEffect(() => {
    if (!isMobile) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setSheetHeight(`${Math.round(vv.height * 0.88)}px`);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, [isMobile]);

  // Scroll to bottom when new messages arrive or drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [messages.length, open]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => onOpenChange(true)}
          className="fixed bottom-6 right-6 z-20 w-13 h-13 bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-full shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="Sohbeti aç"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={[
            "flex flex-col gap-0 p-0 border-border",
            isMobile ? "rounded-t-2xl" : "w-[360px] sm:max-w-[360px]",
          ].join(" ")}
          style={isMobile ? { height: sheetHeight } : undefined}
        >
          {/* Header */}
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              Sohbet
            </SheetTitle>
          </SheetHeader>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Henüz mesaj yok</p>
                <p className="text-xs text-muted-foreground mt-1">İlk mesajı gönder!</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.user_id === currentUser.id;
                const prevMsg = messages[i - 1];
                const nextMsg = messages[i + 1];
                const isFirstInGroup = !prevMsg || prevMsg.user_id !== msg.user_id;
                const isLastInGroup = !nextMsg || nextMsg.user_id !== msg.user_id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${isFirstInGroup ? "mt-3" : "mt-0.5"}`}
                  >
                    {isFirstInGroup && !isMe && (
                      <span className="text-[11px] font-semibold text-muted-foreground mb-1 ml-1">
                        {msg.username}
                      </span>
                    )}
                    <div
                      className={[
                        "max-w-[78%] px-3 py-2 text-sm leading-relaxed",
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                        // Bubble shaping: round all corners, flatten the tail corner
                        isMe
                          ? `rounded-2xl ${isLastInGroup ? "rounded-br-sm" : ""}`
                          : `rounded-2xl ${isLastInGroup ? "rounded-bl-sm" : ""}`,
                      ].join(" ")}
                    >
                      {msg.content}
                    </div>
                    {isLastInGroup && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                        {fmtTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="px-4 py-3 border-t border-border shrink-0 flex gap-2 items-center"
          >
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Mesaj yaz..."
              className="flex-1 h-10 rounded-xl bg-muted border-0 focus-visible:ring-2 focus-visible:ring-primary/50 text-sm"
              autoComplete="off"
              maxLength={1000}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim()}
              className="h-10 w-10 p-0 rounded-xl shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
