import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, BellRing, Send } from "lucide-react";

const highlights = [
  { icon: ShieldCheck, text: "100% verified job listings" },
  { icon: BellRing, text: "Real-time alerts on new roles" },
  { icon: Send, text: "Instant Telegram notifications" },
];

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid lg:grid-cols-2 min-h-[calc(100vh-4rem)]">
      <div className="relative hidden lg:block overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80"
          alt="Professionals collaborating in a modern office"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-darkGreen/80 to-brandGreen/70" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
          <div />
          <div>
            <h2 className="text-3xl font-extrabold leading-tight max-w-sm">
              Find your next opportunity, faster.
            </h2>
            <p className="mt-4 text-white/70 max-w-sm text-sm leading-relaxed">
              Join thousands of job seekers and employers across Ethiopia on the Beleqet Vacancy Platform.
            </p>
            <ul className="mt-8 space-y-3">
              {highlights.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/50">© {new Date().getFullYear()} Beleqet Jobs. All rights reserved.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12 bg-pageBg">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
          <p className="text-muted text-sm mt-2">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
