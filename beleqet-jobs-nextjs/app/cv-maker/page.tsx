"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Award,
  Briefcase,
  Check,
  Download,
  FileText,
  GraduationCap,
  Languages,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { authenticatedFetch } from "@/lib/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Experience = {
  id: number;
  role: string;
  company: string;
  start: string;
  end: string;
  description: string;
};
type Education = {
  id: number;
  school: string;
  qualification: string;
  year: string;
};
type CvData = {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
  skills: string;
  languages: string;
  experience: Experience[];
  education: Education[];
};

const emptyCv: CvData = {
  fullName: "",
  title: "",
  email: "",
  phone: "",
  location: "",
  website: "",
  summary: "",
  skills: "",
  languages: "",
  experience: [
    { id: 1, role: "", company: "", start: "", end: "", description: "" },
  ],
  education: [{ id: 1, school: "", qualification: "", year: "" }],
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brandGreen focus:ring-2 focus:ring-brandGreen/10";

export default function CvMakerPage() {
  const { user, ready } = useAuth();
  const [cv, setCv] = useState<CvData>(emptyCv);
  const [uploadedFile, setUploadedFile] = useState("");
  const [saved, setSaved] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      authenticatedFetch(`${API_URL}/users/cv-draft`).then(async (response) => {
        if (response.ok) {
          const draft = await response.json();
          if (draft?.data) setCv(draft.data);
        }
      });
    } else {
      const draft = localStorage.getItem("beleqet_cv_draft");
      if (draft)
        try {
          setCv(JSON.parse(draft));
        } catch {
          /* ignore invalid local draft */
        }
    }
  }, [ready, user]);

  function field<K extends keyof CvData>(key: K, value: CvData[K]) {
    setCv((old) => ({ ...old, [key]: value }));
    setSaved(false);
  }
  function updateExperience(id: number, key: keyof Experience, value: string) {
    field(
      "experience",
      cv.experience.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    );
  }
  function updateEducation(id: number, key: keyof Education, value: string) {
    field(
      "education",
      cv.education.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    );
  }
  async function saveDraft() {
    if (user) {
      const response = await authenticatedFetch(`${API_URL}/users/cv-draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: cv }),
      });
      setSaved(response.ok);
    } else {
      localStorage.setItem("beleqet_cv_draft", JSON.stringify(cv));
      setSaved(true);
    }
  }
  async function generateSummary() {
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch("/api/cv-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cv.fullName,
          title: cv.title,
          skills: cv.skills,
          experience: cv.experience.map(({ role, company, description }) => ({
            role,
            company,
            description,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not generate a summary.");
      field("summary", data.summary);
      setSaved(false);
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "Could not generate a summary.",
      );
    } finally {
      setAiLoading(false);
    }
  }
  function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Please choose a file smaller than 5 MB.");
      e.target.value = "";
      return;
    }
    setUploadedFile(file.name);
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-primary/10 bg-primary text-white print:hidden">
        <div className="container-page flex flex-col justify-between gap-8 py-12 lg:flex-row lg:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              <Sparkles className="h-4 w-4" /> Free CV builder
            </p>
            <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-black leading-none tracking-[-.055em]">
              Build a CV that
              <br />
              gets you noticed.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/60">
              Complete each section, preview your CV instantly, save your draft,
              and export a clean PDF—no payment required.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={saveDraft}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10"
            >
              {saved ? (
                <Check className="h-4 w-4 text-[#d8ff3e]" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "Draft saved" : "Save draft"}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full bg-[#d8ff3e] px-5 py-3 text-sm font-extrabold text-primary hover:bg-white"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.82fr)] print:block print:p-0">
        <div className="space-y-5 print:hidden">
          <Section
            icon={UploadCloud}
            title="Upload an existing CV"
            subtitle="Keep your current file with your profile, then use the builder to improve it."
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={upload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/15 bg-[#f7f5ef] px-5 py-7 text-sm font-bold text-primary transition hover:border-brandGreen hover:bg-brandGreen/5"
            >
              <FileText className="h-6 w-6 text-brandGreen" />
              {uploadedFile || "Choose PDF, DOC, or DOCX (max 5 MB)"}
            </button>
            {uploadError && (
              <p role="alert" className="mt-3 rounded-xl bg-redAccent/10 px-4 py-3 text-sm font-semibold text-redAccent">
                {uploadError}
              </p>
            )}
          </Section>

          <Section
            icon={UserRound}
            title="Personal details"
            subtitle="How employers can identify and contact you."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                placeholder="e.g. Henok Mekonnen"
                value={cv.fullName}
                onChange={(v) => field("fullName", v)}
              />
              <Input
                label="Professional title"
                placeholder="e.g. Senior Product Designer"
                value={cv.title}
                onChange={(v) => field("title", v)}
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={cv.email}
                onChange={(v) => field("email", v)}
              />
              <Input
                label="Phone"
                placeholder="e.g. +251 911 234 567"
                value={cv.phone}
                onChange={(v) => field("phone", v)}
              />
              <Input
                label="Location"
                placeholder="e.g. Addis Ababa, Ethiopia"
                value={cv.location}
                onChange={(v) => field("location", v)}
              />
              <Input
                label="Portfolio or LinkedIn"
                placeholder="e.g. linkedin.com/in/your-name"
                value={cv.website}
                onChange={(v) => field("website", v)}
              />
            </div>
          </Section>

          <Section
            icon={FileText}
            title="Professional summary"
            subtitle="Write it yourself or let Groq create a focused draft from your details."
          >
            <textarea
              rows={5}
              value={cv.summary}
              onChange={(e) => field("summary", e.target.value)}
              className={inputClass}
              placeholder="Results-driven professional with experience in…"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={generateSummary}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brandGreen disabled:cursor-wait disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />{" "}
                {aiLoading ? "Writing summary…" : "Write with Groq AI"}
              </button>
              {aiError && (
                <p className="text-xs font-semibold text-redAccent">
                  {aiError}
                </p>
              )}
            </div>
          </Section>

          <Section
            icon={Briefcase}
            title="Work experience"
            subtitle="Start with your most recent role."
          >
            <div className="space-y-5">
              {cv.experience.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-primary/10 bg-[#f7f5ef] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-brandGreen">
                      Position {index + 1}
                    </p>
                    {cv.experience.length > 1 && (
                      <button
                        onClick={() =>
                          field(
                            "experience",
                            cv.experience.filter((x) => x.id !== item.id),
                          )
                        }
                        className="text-redAccent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Job title"
                      placeholder="e.g. Marketing Manager"
                      value={item.role}
                      onChange={(v) => updateExperience(item.id, "role", v)}
                    />
                    <Input
                      label="Company"
                      placeholder="e.g. Acme Ethiopia"
                      value={item.company}
                      onChange={(v) => updateExperience(item.id, "company", v)}
                    />
                    <Input
                      label="Start date"
                      placeholder="e.g. Jan 2022"
                      value={item.start}
                      onChange={(v) => updateExperience(item.id, "start", v)}
                    />
                    <Input
                      label="End date"
                      placeholder="e.g. Present"
                      value={item.end}
                      onChange={(v) => updateExperience(item.id, "end", v)}
                    />
                  </div>
                  <label className="mt-4 block text-xs font-bold text-ink">
                    Key achievements
                    <textarea
                      rows={3}
                      value={item.description}
                      onChange={(e) =>
                        updateExperience(item.id, "description", e.target.value)
                      }
                      className={inputClass}
                      placeholder="Describe your impact using specific results and achievements…"
                    />
                  </label>
                </div>
              ))}
            </div>
            <AddButton
              label="Add experience"
              onClick={() =>
                field("experience", [
                  ...cv.experience,
                  {
                    id: Date.now(),
                    role: "",
                    company: "",
                    start: "",
                    end: "",
                    description: "",
                  },
                ])
              }
            />
          </Section>

          <Section
            icon={GraduationCap}
            title="Education"
            subtitle="Add degrees, certificates, or relevant training."
          >
            <div className="space-y-4">
              {cv.education.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-2xl border border-primary/10 bg-[#f7f5ef] p-4 sm:grid-cols-[1fr_1fr_.5fr_auto]"
                >
                  <Input
                    label="School"
                    placeholder="e.g. Addis Ababa University"
                    value={item.school}
                    onChange={(v) => updateEducation(item.id, "school", v)}
                  />
                  <Input
                    label="Qualification"
                    placeholder="e.g. BSc in Computer Science"
                    value={item.qualification}
                    onChange={(v) =>
                      updateEducation(item.id, "qualification", v)
                    }
                  />
                  <Input
                    label="Year"
                    placeholder="e.g. 2024"
                    value={item.year}
                    onChange={(v) => updateEducation(item.id, "year", v)}
                  />
                  {cv.education.length > 1 && (
                    <button
                      onClick={() =>
                        field(
                          "education",
                          cv.education.filter((x) => x.id !== item.id),
                        )
                      }
                      className="mt-7 text-redAccent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <AddButton
              label="Add education"
              onClick={() =>
                field("education", [
                  ...cv.education,
                  { id: Date.now(), school: "", qualification: "", year: "" },
                ])
              }
            />
          </Section>

          <div className="grid gap-5 sm:grid-cols-2">
            <Section
              icon={Award}
              title="Skills"
              subtitle="Separate skills with commas."
            >
              <textarea
                rows={4}
                value={cv.skills}
                onChange={(e) => field("skills", e.target.value)}
                className={inputClass}
                placeholder="Project management, Excel, Figma"
              />
            </Section>
            <Section
              icon={Languages}
              title="Languages"
              subtitle="Include proficiency where useful."
            >
              <textarea
                rows={4}
                value={cv.languages}
                onChange={(e) => field("languages", e.target.value)}
                className={inputClass}
                placeholder="Amharic — Native, English — Fluent"
              />
            </Section>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start print:static">
          <CvPreview cv={cv} />
        </aside>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
      <div className="mb-5 flex gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d8ff3e] text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-extrabold text-primary">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-bold text-ink">
      {label}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brandGreen"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

function CvPreview({ cv }: { cv: CvData }) {
  const skills = cv.skills
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return (
    <div className="min-h-[760px] overflow-hidden bg-white shadow-[0_20px_60px_rgba(4,22,3,.12)] print:min-h-0 print:shadow-none">
      <div className="bg-primary px-8 py-9 text-white">
        <p className="text-3xl font-black tracking-tight">
          {cv.fullName || "Your Name"}
        </p>
        <p className="mt-1 text-sm font-bold text-[#d8ff3e]">
          {cv.title || "Professional title"}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/65">
          {[
            cv.email || "email@example.com",
            cv.phone || "+251 900 000 000",
            cv.location || "Addis Ababa, Ethiopia",
            cv.website,
          ]
            .filter(Boolean)
            .map((x) => (
              <span key={x}>{x}</span>
            ))}
        </div>
      </div>
      <div className="space-y-7 p-8 text-primary">
        {cv.summary && (
          <PreviewSection title="Profile">
            <p className="text-xs leading-5 text-muted">{cv.summary}</p>
          </PreviewSection>
        )}
        <PreviewSection title="Experience">
          {cv.experience.filter((x) => x.role || x.company).length ? (
            cv.experience
              .filter((x) => x.role || x.company)
              .map((x) => (
                <div key={x.id} className="mb-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-sm font-extrabold">
                        {x.role || "Role"}
                      </p>
                      <p className="text-xs font-semibold text-brandGreen">
                        {x.company}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted">
                      {x.start}
                      {x.start && x.end && " – "}
                      {x.end}
                    </p>
                  </div>
                  {x.description && (
                    <p className="mt-2 whitespace-pre-line text-xs leading-5 text-muted">
                      {x.description}
                    </p>
                  )}
                </div>
              ))
          ) : (
            <EmptyPreview text="Your work experience will appear here." />
          )}
        </PreviewSection>
        <PreviewSection title="Education">
          {cv.education.filter((x) => x.school || x.qualification).length ? (
            cv.education
              .filter((x) => x.school || x.qualification)
              .map((x) => (
                <div key={x.id} className="mb-3 flex justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold">{x.qualification}</p>
                    <p className="text-[11px] text-muted">{x.school}</p>
                  </div>
                  <p className="text-[10px] text-muted">{x.year}</p>
                </div>
              ))
          ) : (
            <EmptyPreview text="Your education will appear here." />
          )}
        </PreviewSection>
        {skills.length > 0 && (
          <PreviewSection title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-brandGreen/10 px-2.5 py-1 text-[10px] font-bold text-brandGreen"
                >
                  {skill}
                </span>
              ))}
            </div>
          </PreviewSection>
        )}
        {cv.languages && (
          <PreviewSection title="Languages">
            <p className="text-xs text-muted">{cv.languages}</p>
          </PreviewSection>
        )}
      </div>
    </div>
  );
}
function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 border-b-2 border-[#d8ff3e] pb-1 text-[11px] font-black uppercase tracking-[.18em]">
        {title}
      </h3>
      {children}
    </section>
  );
}
function EmptyPreview({ text }: { text: string }) {
  return <p className="text-xs italic text-muted/60">{text}</p>;
}
