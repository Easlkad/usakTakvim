"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";

export default function Home() {
  const { user, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      router.replace("/rooms");
    } else {
      router.replace("/auth");
    }
  }, [user, hydrated, router]);

  return null;
}
