"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { AuthSession } from "../assets/@types/auth.types";
import { useAuth } from "./useAuth";

export function loginPath(returnTo: string): string {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}

export function useRequireSession(): AuthSession | null {
  const { session, isReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isReady && !session) {
      router.replace(loginPath(pathname));
    }
  }, [isReady, session, router, pathname]);

  return isReady ? session : null;
}
