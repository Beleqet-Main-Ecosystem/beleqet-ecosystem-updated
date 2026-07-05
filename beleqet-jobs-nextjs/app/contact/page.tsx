"use client";

import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  Send,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          subject: form.get("subject"),
          message: form.get("message"),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "Message could not be sent.",
        );
      setReference(data.reference);
      event.currentTarget.reset();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Message could not be sent.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#f7f5ef]">
      <section className="bg-primary py-16 text-white lg:py-20">
        <div className="container-page">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            Contact Beleqet
          </p>
          <h1 className="max-w-3xl text-[clamp(2.8rem,7vw,6rem)] font-black leading-[.9] tracking-[-.06em]">
            Let’s solve it
            <br />
            together.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/60">
            Questions about an account, listing, hiring plan, or partnership?
            Send the details and our team will follow up.
          </p>
        </div>
      </section>
      <div className="container-page grid gap-10 py-16 lg:grid-cols-[.75fr_1.25fr]">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-primary">
            Talk to the right team
          </h2>
          <div className="mt-7 space-y-4">
            <ContactItem
              icon={MapPin}
              title="Visit"
              text="Addis Ababa, Ethiopia"
            />
            <ContactItem icon={Mail} title="Email" text="support@beleqet.com" />
            <ContactItem
              icon={Clock3}
              title="Response time"
              text="Within two business days"
            />
          </div>
          <div className="mt-10 rounded-[24px] bg-[#d8ff3e] p-6 text-primary">
            <MessageSquareText className="h-6 w-6" />
            <p className="mt-5 text-lg font-black">Include useful details</p>
            <p className="mt-2 text-sm leading-6 text-primary/65">
              For listing or account issues, include the email used on Beleqet
              and any relevant job reference. Never send passwords.
            </p>
          </div>
        </div>
        <div className="rounded-[28px] border border-primary/10 bg-white p-6 shadow-sm sm:p-8">
          {reference ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brandGreen/10 text-brandGreen">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h2 className="mt-6 text-2xl font-black text-primary">
                Message received
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                Your message was saved successfully. Keep this reference if you
                contact us again.
              </p>
              <code className="mt-5 rounded-lg bg-[#f7f5ef] px-3 py-2 text-xs text-primary">
                {reference}
              </code>
              <button
                onClick={() => setReference("")}
                className="mt-6 text-sm font-bold text-brandGreen"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <h2 className="text-2xl font-black text-primary">
                  Send a message
                </h2>
                <p className="mt-1 text-sm text-muted">
                  All fields are required.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="name" label="Full name" minLength={2} placeholder="e.g. Henok Mekonnen" />
                <Field name="email" label="Email address" type="email" placeholder="you@example.com" />
              </div>
              <Field name="subject" label="Subject" minLength={3} placeholder="What do you need help with?" />
              <label className="block text-xs font-bold text-ink">
                How can we help?
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={7}
                  placeholder="Tell us how we can help…"
                  className="mt-1.5 w-full rounded-xl border border-primary/10 px-3.5 py-3 text-sm outline-none focus:border-brandGreen"
                />
              </label>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-redAccent/10 px-4 py-3 text-sm font-semibold text-redAccent"
                >
                  {error}
                </p>
              )}
              <button
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-bold text-white hover:bg-brandGreen disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send message"}
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  minLength,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  minLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-bold text-ink">
      {label}
      <input
        name={name}
        type={type}
        required
        minLength={minLength}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-primary/10 px-3.5 py-3 text-sm outline-none focus:border-brandGreen"
      />
    </label>
  );
}
function ContactItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Mail;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-primary/10 bg-white p-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brandGreen/10 text-brandGreen">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          {title}
        </p>
        <p className="mt-0.5 text-sm font-bold text-primary">{text}</p>
      </div>
    </div>
  );
}
