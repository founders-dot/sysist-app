import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sysist - AI Booking Assistant',
  description: 'Make restaurant reservations, book hotels, and arrange taxis with AI-powered phone calls',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
