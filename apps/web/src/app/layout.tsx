import { rubik } from '@/core/assets/style/fonts/font';
import { AuthProvider } from '@/core/features/auth/lib/AuthProvider';
import type { Metadata } from 'next';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'فروش ویژه',
  description: 'خرید سریع محصول فروش ویژه با پیگیری زنده‌ی وضعیت سفارش',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" suppressHydrationWarning dir="rtl">
      <body className={`${rubik.variable} antialiased`}>
        <NextTopLoader color="#ffa00a" />
        <Toaster />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
