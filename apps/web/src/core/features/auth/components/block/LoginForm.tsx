"use client";

import { Button } from "@/core/components/shadcn/ui/button/button";
import { Input } from "@/core/components/shadcn/ui/input/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../hook/useAuth";

const DEFAULT_DESTINATION = "/product";

function safeDestination(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : DEFAULT_DESTINATION;
}

function loginErrorMessage(status: number): string {
  if (status === 0) {
    return "اتصال به سرور برقرار نشد. دوباره تلاش کنید.";
  }
  if (status === 429) {
    return "درخواست‌ها زیاد است. چند لحظه بعد دوباره تلاش کنید.";
  }
  if (status === 400) {
    return "نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد و . _ - باشد.";
  }
  return "ورود انجام نشد. دوباره تلاش کنید.";
}

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("user1");
  const [password, setPassword] = useState("any");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const failure = await login(username.trim(), password);
    if (failure) {
      setErrorMessage(loginErrorMessage(failure.status));
      setIsSubmitting(false);
      return;
    }
    router.replace(safeDestination(searchParams.get("next")));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card flex w-full max-w-sm flex-col gap-5 rounded-lg p-6 sm:p-8"
      aria-describedby={errorMessage ? "login-error" : undefined}
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-medium">ورود به فروش ویژه</h1>
        <p className="text-muted-foreground text-sm">
          ورود آزمایشی است؛ هر نام کاربری و رمزی پذیرفته می‌شود.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <Input
          label="نام کاربری"
          name="username"
          autoComplete="username"
          dir="ltr"
          required
          maxLength={64}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="h-11"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <Input
          label="رمز عبور"
          name="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
        />
      </label>

      {errorMessage && (
        <p id="login-error" role="alert" className="text-destructive text-sm">
          {errorMessage}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "در حال ورود…" : "ورود"}
      </Button>
    </form>
  );
}
