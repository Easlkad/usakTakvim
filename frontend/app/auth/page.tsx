"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await api.auth.login(fd.get("username") as string, fd.get("password") as string);
      setAuth({ id: res.id, username: res.username, is_superuser: res.is_superuser }, res.token);
      router.replace("/rooms");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await api.auth.register(fd.get("username") as string, fd.get("password") as string);
      toast.success("Kayıt başarılı! Giriş yapabilirsiniz.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-700" />

      {/* Mesh overlay */}
      <div className="absolute inset-0"
        style={{ backgroundImage: "radial-gradient(ellipse at 20% 20%, rgba(167,139,250,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(99,102,241,0.4) 0%, transparent 55%)" }}
      />

      {/* Floating blobs */}
      <div className="absolute top-16 left-8 w-72 h-72 bg-violet-400/20 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-16 right-8 w-80 h-80 bg-indigo-400/25 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <div className="relative w-full max-w-md z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/15 backdrop-blur-md rounded-2xl mb-5 shadow-lg border border-white/20">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-sm">
            UsakTakvim
          </h1>
          <p className="text-violet-200 mt-2.5 text-base">Ortak takvim ve etkinlik planlama</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 dark:border-white/10 p-8">
          <h2 className="text-xl font-bold text-foreground mb-1">Hoş geldiniz</h2>
          <p className="text-sm text-muted-foreground mb-6">Devam etmek için giriş yapın veya kayıt olun</p>

          <Tabs defaultValue="login">
            <TabsList className="w-full mb-7 bg-muted rounded-xl p-1 h-auto">
              <TabsTrigger value="login" className="flex-1 rounded-lg py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-card">
                Giriş Yap
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1 rounded-lg py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-card">
                Kayıt Ol
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-username" className="text-sm font-semibold">Kullanıcı Adı</Label>
                  <Input
                    id="login-username"
                    name="username"
                    autoComplete="username"
                    required
                    placeholder="kullaniciadi"
                    className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-2 focus-visible:ring-primary/60 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-semibold">Şifre</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-2 focus-visible:ring-primary/60 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="reg-username" className="text-sm font-semibold">Kullanıcı Adı</Label>
                  <Input
                    id="reg-username"
                    name="username"
                    autoComplete="username"
                    required
                    placeholder="kullaniciadi"
                    minLength={3}
                    className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-2 focus-visible:ring-primary/60 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-sm font-semibold">Şifre</Label>
                  <Input
                    id="reg-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    minLength={6}
                    className="h-11 rounded-xl bg-muted border-0 focus-visible:ring-2 focus-visible:ring-primary/60 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
