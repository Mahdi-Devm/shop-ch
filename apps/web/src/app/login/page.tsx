import { LoginForm } from "@/core/features/auth/components/block/LoginForm";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <main className="pages-container flex min-h-screen items-center justify-center py-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
