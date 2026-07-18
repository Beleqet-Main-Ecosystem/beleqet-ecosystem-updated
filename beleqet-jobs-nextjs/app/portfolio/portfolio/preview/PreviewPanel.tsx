"use client";

import type { LanguageCode, MasterProfileData } from "../types";
import { getTemplateMeta } from "../constants/templates";
import { readLocalized } from "../utils/localized";
import { cn } from "@/lib/utils";

type PreviewPanelProps = {
  data: MasterProfileData;
  locale: LanguageCode;
};

/**
 * Live preview panel — re-renders instantly from builder state.
 */
export function PreviewPanel({ data, locale }: PreviewPanelProps) {
  const template = getTemplateMeta(data.templateId);
  const name = data.profile.fullName || "Your Name";
  const headline = readLocalized(data.profile.headline, locale);
  const jobTitle = readLocalized(data.profile.jobTitle, locale);
  const summary = readLocalized(data.summary, locale);

  return (
    <div
      className="sticky top-24 overflow-hidden rounded-2xl border border-primary/10 bg-[#fffdf8] shadow-sm"
      aria-label="Portfolio live preview"
    >
      <div className="border-b border-primary/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
        Live preview · {template.name.en}
      </div>
      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-5">
        <article className={cn("space-y-6", template.previewClass, "p-5")}>
          <header className="space-y-2">
            {data.profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.profile.avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                {name.charAt(0) || "?"}
              </div>
            )}
            <h1 className="text-2xl font-extrabold text-primary">{name}</h1>
            {headline && (
              <p className="text-sm font-semibold text-brandGreen">{headline}</p>
            )}
            {jobTitle && <p className="text-sm text-ink/70">{jobTitle}</p>}
            {data.profile.location && (
              <p className="text-xs text-ink/50">{data.profile.location}</p>
            )}
            {data.industries.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {data.industries.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink/60"
                  >
                    {tag.replace("_", " ")}
                  </span>
                ))}
              </div>
            )}
          </header>

          {summary && (
            <section>
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink/40">
                Summary
              </h2>
              <p className="text-sm leading-6 text-ink/80">{summary}</p>
            </section>
          )}

          {data.projects.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-ink/40">
                Projects
              </h2>
              <div className="space-y-3">
                {[...data.projects]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((project) => (
                    <div
                      key={project.id}
                      className="rounded-xl border border-primary/10 bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-primary">
                          {readLocalized(project.title, locale) || "Untitled"}
                        </h3>
                        {project.featured && (
                          <span className="text-[10px] font-bold uppercase text-brandGreen">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink/70">
                        {readLocalized(project.description, locale)}
                      </p>
                      {project.technologies.length > 0 && (
                        <p className="mt-2 text-[10px] text-ink/50">
                          {project.technologies.join(" · ")}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {data.skills.some((g) => g.skills.length > 0) && (
            <section>
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-ink/40">
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.skills.flatMap((group) =>
                  group.skills.map((skill) => (
                    <span
                      key={skill.id}
                      className="rounded-full border border-primary/10 px-2.5 py-1 text-xs font-semibold text-ink/80"
                    >
                      {readLocalized(skill.name, locale)}
                    </span>
                  )),
                )}
              </div>
            </section>
          )}

          {data.contact.email && (
            <footer className="border-t border-primary/10 pt-4 text-xs text-ink/60">
              {data.contact.email}
              {data.contact.phone ? ` · ${data.contact.phone}` : ""}
            </footer>
          )}
        </article>
      </div>
    </div>
  );
}
