"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LogOut,
  User,
  Briefcase,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export const roleMeta: Record<string, { label: string; className: string }> = {
  JOB_SEEKER: {
    label: "Job Seeker",
    className: "bg-brandGreen/10 text-brandGreen",
  },
  EMPLOYER: {
    label: "Employer",
    className: "bg-cyanAccent/10 text-cyanAccent",
  },
  FREELANCER: {
    label: "Freelancer",
    className: "bg-purpleAccent/10 text-purpleAccent",
  },
  ADMIN: { label: "Admin", className: "bg-orangeAccent/10 text-orangeAccent" },
};

export default function HeaderAuth() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!ready)
    return <div className="h-9 w-9 rounded-full bg-pageBg animate-pulse" />;

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/login"
          className="inline-block rounded-full px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:text-brandGreen"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="inline-block rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-brandGreen hover:text-brandGreen"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  const role = roleMeta[user.role] ?? {
    label: user.role,
    className: "bg-muted/10 text-muted",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2 hover:bg-pageBg transition-colors"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brandGreen to-darkGreen text-white text-xs font-bold uppercase">
          {initials}
        </span>
        <span className="hidden sm:block max-w-[7rem] truncate text-sm font-medium text-ink">
          {user.firstName}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-white shadow-cardHover">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brandGreen to-darkGreen text-sm font-bold uppercase text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>
            <span
              className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${role.className}`}
            >
              {role.label}
            </span>
          </div>
          <div className="p-1.5">
            <MenuLink
              href="/profile"
              icon={User}
              onClick={() => setOpen(false)}
            >
              My Profile
            </MenuLink>
            <MenuLink
              href={
                user.role === "EMPLOYER"
                  ? "/employer"
                  : user.role === "JOB_SEEKER"
                    ? "/applications"
                    : "/jobs"
              }
              icon={Briefcase}
              onClick={() => setOpen(false)}
            >
              {user.role === "EMPLOYER"
                ? "Hiring Dashboard"
                : user.role === "JOB_SEEKER"
                  ? "My Applications"
                  : "Browse Jobs"}
            </MenuLink>
            {user.role === "ADMIN" && (
              <MenuLink
                href="/admin"
                icon={ShieldCheck}
                onClick={() => setOpen(false)}
              >
                Admin Dashboard
              </MenuLink>
            )}
            <button
              onClick={() => {
                logout();
                setOpen(false);
                router.push("/");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-redAccent hover:bg-redAccent/5 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  onClick,
  children,
}: {
  href: string;
  icon: typeof User;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-pageBg transition-colors"
    >
      <Icon className="h-4 w-4 text-muted" />
      {children}
    </Link>
  );
}
