"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Briefcase,
  Clock3,
  ExternalLink,
  MapPin,
  XCircle,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type Application = {
  id: string;
  status: string;
  createdAt: string;
  job: {
    id: string;
    title: string;
    location: string;
    company: { name: string };
  };
};
type Saved = {
  id: string;
  job: {
    id: string;
    title: string;
    location: string;
    company: { name: string };
  };
};

export default function ApplicationsPage() {
  const { user, ready } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [tab, setTab] = useState("applications");
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [a, s] = await Promise.all([
      authenticatedFetch(`${API_URL}/applications/my`),
      authenticatedFetch(`${API_URL}/users/saved-jobs`),
    ]);
    if (a.ok) setApplications(await a.json());
    if (s.ok) setSaved(await s.json());
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  if (!ready || !user)
    return (
      <div className="container-page py-24 text-center text-muted">
        Sign in to view your career activity.
      </div>
    );
  async function withdraw(id: string) {
    const response = await authenticatedFetch(
      `${API_URL}/applications/${id}/withdraw`,
      { method: "PATCH" },
    );
    if (response.ok) await load();
    setWithdrawId(null);
  }
  async function unsave(jobId: string) {
    await authenticatedFetch(`${API_URL}/users/saved-jobs/${jobId}`, {
      method: "DELETE",
    });
    load();
  }
  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="bg-primary py-14 text-white">
        <div className="container-page">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            Career dashboard
          </p>
          <h1 className="mt-3 text-4xl font-black">Your opportunities</h1>
        </div>
      </section>
      <div className="container-page py-10">
        <div className="mb-7 flex gap-2">
          <button
            onClick={() => setTab("applications")}
            className={`rounded-full px-5 py-2.5 text-sm font-bold ${tab === "applications" ? "bg-primary text-white" : "bg-white"}`}
          >
            Applications ({applications.length})
          </button>
          <button
            onClick={() => setTab("saved")}
            className={`rounded-full px-5 py-2.5 text-sm font-bold ${tab === "saved" ? "bg-primary text-white" : "bg-white"}`}
          >
            Saved jobs ({saved.length})
          </button>
        </div>
        {tab === "applications" ? (
          <div className="space-y-3">
            {applications.length ? (
              applications.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col justify-between gap-5 rounded-2xl border border-primary/10 bg-white p-5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-primary">
                        {item.job.title}
                      </h2>
                      <Status value={item.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {item.job.company.name}
                    </p>
                    <p className="mt-2 flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        Applied {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/jobs/${item.job.id}`}
                      className="rounded-full border border-border px-4 py-2 text-xs font-bold"
                    >
                      View job
                    </Link>
                    {["SUBMITTED", "SCREENING", "SHORTLISTED"].includes(
                      item.status,
                    ) && (
                      <button
                        onClick={() => setWithdrawId(item.id)}
                        className="rounded-full px-4 py-2 text-xs font-bold text-redAccent"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <Empty
                icon={Briefcase}
                text="You have not applied to any jobs yet."
              />
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.length ? (
              saved.map((item) => (
                <article key={item.id} className="rounded-2xl bg-white p-5">
                  <Bookmark className="h-5 w-5 fill-brandGreen text-brandGreen" />
                  <h2 className="mt-4 font-extrabold text-primary">
                    {item.job.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {item.job.company.name} · {item.job.location}
                  </p>
                  <div className="mt-5 flex justify-between">
                    <Link
                      href={`/jobs/${item.job.id}`}
                      className="flex items-center gap-1 text-xs font-bold text-brandGreen"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      onClick={() => unsave(item.job.id)}
                      className="text-xs font-bold text-redAccent"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="col-span-full">
                <Empty icon={Bookmark} text="You have no saved jobs." />
              </div>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(withdrawId)}
        onOpenChange={(open) => !open && setWithdrawId(null)}
        title="Withdraw application?"
        description="The employer will no longer consider this application. This action cannot be undone."
        confirmLabel="Withdraw application"
        destructive
        onConfirm={() => {
          if (withdrawId) return withdraw(withdrawId);
        }}
      />
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-brandGreen/10 px-2.5 py-1 text-[10px] font-bold text-brandGreen">
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Empty({ icon: Icon, text }: { icon: typeof Briefcase; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-14 text-center">
      <Icon className="mx-auto h-7 w-7 text-muted" />
      <p className="mt-3 text-sm font-semibold text-muted">{text}</p>
      <Link
        href="/jobs"
        className="mt-4 inline-flex text-sm font-bold text-brandGreen"
      >
        Browse jobs
      </Link>
    </div>
  );
}
