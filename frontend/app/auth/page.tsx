"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-600 tracking-tight">UsakTakvim</h1>
          <p className="text-slate-500 mt-2">Ortak takvim ve etkinlik planlama</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Hoş geldiniz</CardTitle>
            <CardDescription>Devam etmek için giriş yapın veya kayıt olun</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="login" className="flex-1">Giriş Yap</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">Kayıt Ol</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-username">Kullanıcı Adı</Label>
                    <Input id="login-username" name="username" autoComplete="username" required placeholder="kullaniciadi" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Şifre</Label>
                    <Input id="login-password" name="password" type="password" autoComplete="current-password" required placeholder="••••••" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-username">Kullanıcı Adı</Label>
                    <Input id="reg-username" name="username" autoComplete="username" required placeholder="kullaniciadi" minLength={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Şifre</Label>
                    <Input id="reg-password" name="password" type="password" autoComplete="new-password" required placeholder="••••••" minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
