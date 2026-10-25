"use client";

import { Button } from "@/core/components/shadcn/ui/button/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hook/useAuth";

export function SessionBar() {
  const { session, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 py-3">
      <Link
        href="/product"
        className="focus-visible:ring-ring/50 rounded-sm text-lg font-medium outline-none focus-visible:ring-2"
      >
        فروش ویژه
      </Link>
      {session && (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm" dir="ltr">
            {session.userId}
          </span>
          <Button variant="outline" size="sm" className="h-11" onClick={handleLogout}>
            خروج
          </Button>
        </div>
      )}
    </header>
  );
}
