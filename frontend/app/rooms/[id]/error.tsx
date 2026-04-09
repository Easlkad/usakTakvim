"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function RoomError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
      <p className="text-lg font-semibold">Oda yüklenemedi</p>
      <p className="text-sm text-muted-foreground">Bir şeyler ters gitti. Tekrar deneyebilir veya odalar listesine dönebilirsiniz.</p>
      <div className="flex gap-3">
        <Button variant="outline" className="rounded-xl" onClick={() => router.push("/rooms")}>
          Odalara dön
        </Button>
        <Button className="rounded-xl" onClick={reset}>
          Tekrar dene
        </Button>
      </div>
    </div>
  );
}
