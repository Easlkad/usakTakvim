"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { RoomMember, User } from "@/types";
import { toast } from "sonner";
import { UserX, UserCheck, Users, Clock, ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roomId: string;
  currentUser: User;
  roomOwnerId: string;
  isMobile: boolean;
}

export function MembersSheet({ open, onOpenChange, roomId, currentUser, roomOwnerId, isMobile }: Props) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [pending, setPending] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = currentUser.is_superuser || currentUser.id === roomOwnerId;

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        api.rooms.members(roomId),
        isAdmin ? api.rooms.pendingMembers(roomId) : Promise.resolve([]),
      ]);
      setMembers(m);
      setPending(p);
    } catch {
      toast.error("Üyeler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [open, roomId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function approve(userId: string) {
    try {
      await api.rooms.approveMember(roomId, userId);
      setPending(prev => prev.filter(m => m.user_id !== userId));
      const approved = pending.find(m => m.user_id === userId);
      if (approved) setMembers(prev => [...prev, { ...approved, status: "active" }]);
      toast.success("Üye onaylandı");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    }
  }

  async function remove(userId: string) {
    try {
      await api.rooms.removeMember(roomId, userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      toast.success("Üye çıkarıldı");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    }
  }

  async function reject(userId: string) {
    try {
      await api.rooms.removeMember(roomId, userId);
      setPending(prev => prev.filter(m => m.user_id !== userId));
      toast.success("İstek reddedildi");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Hata");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        style={isMobile ? { height: "75vh" } : { width: "360px" }}
        className="flex flex-col p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            Üyeler
            <Badge className="bg-primary/10 text-primary border-0 rounded-full px-2 text-xs font-semibold">
              {members.length}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Pending section — admin only */}
          {isAdmin && pending.length > 0 && (
            <div className="px-4 pt-4">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Onay Bekleyenler ({pending.length})
              </p>
              <div className="space-y-2 mb-4">
                {pending.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        {m.username[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="flex-1 text-sm font-semibold truncate">{m.username}</span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => approve(m.user_id)}
                        className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900 flex items-center justify-center transition-colors"
                        title="Onayla"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => reject(m.user_id)}
                        className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900 flex items-center justify-center transition-colors"
                        title="Reddet"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active members */}
          <div className="px-4 pt-4 pb-4">
            {isAdmin && pending.length > 0 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Aktif Üyeler
              </p>
            )}
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Henüz üye yok</p>
            ) : (
              <div className="space-y-1.5">
                {members.map(m => {
                  const isOwner = m.user_id === roomOwnerId;
                  const isMe = m.user_id === currentUser.id;
                  const canKick = isAdmin && !isOwner && !isMe;
                  return (
                    <div key={m.user_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-white">
                          {m.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                          {m.username}
                          {isMe && <span className="text-xs text-muted-foreground font-normal">(siz)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isOwner && (
                          <Badge className="bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-0 text-xs px-2 rounded-full">
                            Sahip
                          </Badge>
                        )}
                        {m.is_superuser && (
                          <span title="Yönetici"><ShieldCheck className="w-3.5 h-3.5 text-violet-500" /></span>
                        )}
                        {canKick && (
                          <button
                            onClick={() => remove(m.user_id)}
                            className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900 flex items-center justify-center transition-all"
                            title="Odadan çıkar"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
