"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SECTION_CARD_CLASS,
} from "../constants/styles";
import { SortableList } from "../components/SortableList";
import {
  createDefaultCertification,
  createDefaultProject,
} from "../hooks/usePortfolioBuilder";
import type {
  LanguageCode,
  LocalizedText,
  MasterProfileData,
  PortfolioProject,
} from "../types";
import { readLocalized, setLocalized } from "../utils/localized";

type SectionEditorProps = {
  section: MasterProfileData["sectionOrder"][number];
  data: MasterProfileData;
  locale: LanguageCode;
  onChange: (updater: (current: MasterProfileData) => MasterProfileData) => void;
  onReorderProjects: (from: number, to: number) => void;
  onReorderCerts: (from: number, to: number) => void;
  onReorderGallery: (from: number, to: number) => void;
};

/**
 * Renders the active builder section editor form.
 */
export function SectionEditor({
  section,
  data,
  locale,
  onChange,
  onReorderProjects,
  onReorderCerts,
  onReorderGallery,
}: SectionEditorProps) {
  switch (section) {
    case "profile":
      return (
        <ProfileSection data={data} locale={locale} onChange={onChange} />
      );
    case "summary":
      return (
        <LocalizedFieldSection
          title="Professional Summary"
          value={data.summary}
          locale={locale}
          onChange={(summary) => onChange((d) => ({ ...d, summary }))}
          multiline
        />
      );
    case "projects":
      return (
        <ProjectsSection
          projects={data.projects}
          locale={locale}
          onChange={onChange}
          onReorder={onReorderProjects}
        />
      );
    case "skills":
      return (
        <SkillsSection data={data} locale={locale} onChange={onChange} />
      );
    case "certifications":
      return (
        <CertificationsSection
          items={data.certifications}
          locale={locale}
          onChange={onChange}
          onReorder={onReorderCerts}
        />
      );
    case "contact":
      return (
        <ContactSection data={data} locale={locale} onChange={onChange} />
      );

    case "caseStudies":
      return (
        <CaseStudiesSection
          items={data.caseStudies || []}
          locale={locale}
          onChange={onChange}
        />
      );

    case "education":
      return (
        <EducationSection
          items={data.education || []}
          locale={locale}
          onChange={onChange}
        />
      );

    case "experience":
      return (
        <ExperienceSection
          items={data.experience || []}
          locale={locale}
          onChange={onChange}
        />
      );

    case "socialLinks":
      return (
        <SocialLinksSection
          items={data.socialLinks || []}
          locale={locale}
          onChange={onChange}
        />
      );

    case "gallery":
      return (
        <GallerySection
          items={data.gallery}
          locale={locale}
          onChange={onChange}
          onReorder={onReorderGallery}
        />
      );

    default:
      return (
        <div className={SECTION_CARD_CLASS}>
          <p className="text-sm text-ink/60">
            Section editor for <strong>{section}</strong> not implemented yet.
          </p>
        </div>
      );
  }
}

function LocalizedInput({
  label,
  value,
  locale,
  onChange,
  multiline,
}: {
  label: string;
  value: LocalizedText;
  locale: LanguageCode;
  onChange: (next: LocalizedText) => void;
  multiline?: boolean;
}) {
  const common = {
    value: value[locale] || "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(setLocalized(value, locale, e.target.value)),
    className: INPUT_CLASS,
  };
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      {multiline ? (
        <textarea {...common} rows={4} />
      ) : (
        <input type="text" {...common} />
      )}
    </div>
  );
}

function ProfileSection({
  data,
  locale,
  onChange,
}: {
  data: MasterProfileData;
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
}) {
  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <h3 className="text-lg font-extrabold text-primary">Profile</h3>
      <div>
        <label className={LABEL_CLASS}>Full name</label>
        <input
          type="text"
          className={INPUT_CLASS}
          value={data.profile.fullName}
          onChange={(e) =>
            onChange((d) => ({
              ...d,
              profile: { ...d.profile, fullName: e.target.value },
            }))
          }
        />
      </div>
      <LocalizedInput
        label="Headline"
        value={data.profile.headline}
        locale={locale}
        onChange={(headline) =>
          onChange((d) => ({ ...d, profile: { ...d.profile, headline } }))
        }
      />
      <LocalizedInput
        label="Job title"
        value={data.profile.jobTitle}
        locale={locale}
        onChange={(jobTitle) =>
          onChange((d) => ({ ...d, profile: { ...d.profile, jobTitle } }))
        }
      />
      <div>
        <label className={LABEL_CLASS}>Location</label>
        <input
          type="text"
          className={INPUT_CLASS}
          value={data.profile.location}
          onChange={(e) =>
            onChange((d) => ({
              ...d,
              profile: { ...d.profile, location: e.target.value },
            }))
          }
        />
      </div>
      <div>
        <label className={LABEL_CLASS}>Avatar URL</label>
        <input
          type="url"
          className={INPUT_CLASS}
          value={data.profile.avatarUrl}
          onChange={(e) =>
            onChange((d) => ({
              ...d,
              profile: { ...d.profile, avatarUrl: e.target.value },
            }))
          }
        />
      </div>
    </div>
  );
}

function LocalizedFieldSection({
  title,
  value,
  locale,
  onChange,
  multiline,
}: {
  title: string;
  value: LocalizedText;
  locale: LanguageCode;
  onChange: (value: LocalizedText) => void;
  multiline?: boolean;
}) {
  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <h3 className="text-lg font-extrabold text-primary">{title}</h3>
      <LocalizedInput
        label={`Content (${locale.toUpperCase()})`}
        value={value}
        locale={locale}
        onChange={onChange}
        multiline={multiline}
      />
    </div>
  );
}

function ProjectsSection({
  projects,
  locale,
  onChange,
  onReorder,
}: {
  projects: PortfolioProject[];
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
  onReorder: (from: number, to: number) => void;
}) {
  const sorted = [...projects].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-primary">Projects</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange((d) => ({
              ...d,
              projects: [...d.projects, createDefaultProject(d.projects.length)],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add project
        </Button>
      </div>
      <SortableList
        items={sorted}
        onReorder={onReorder}
        ariaLabel="Reorder projects"
        renderItem={(project) => (
          <ProjectCardEditor
            project={project}
            locale={locale}
            onChange={(next) =>
              onChange((d) => ({
                ...d,
                projects: d.projects.map((p) =>
                  p.id === project.id ? next : p,
                ),
              }))
            }
            onRemove={() =>
              onChange((d) => ({
                ...d,
                projects: d.projects.filter((p) => p.id !== project.id),
              }))
            }
          />
        )}
      />
    </div>
  );
}

function ProjectCardEditor({
  project,
  locale,
  onChange,
  onRemove,
}: {
  project: PortfolioProject;
  locale: LanguageCode;
  onChange: (p: PortfolioProject) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-primary">
          {readLocalized(project.title, locale) || "New project"}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="text-redAccent hover:underline"
          aria-label="Remove project"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <LocalizedInput
        label="Title"
        value={project.title}
        locale={locale}
        onChange={(title) => onChange({ ...project, title })}
      />
      <LocalizedInput
        label="Description"
        value={project.description}
        locale={locale}
        onChange={(description) => onChange({ ...project, description })}
        multiline
      />
      <div>
        <label className={LABEL_CLASS}>Technologies (comma-separated)</label>
        <input
          type="text"
          className={INPUT_CLASS}
          value={project.technologies.join(", ")}
          onChange={(e) =>
            onChange({
              ...project,
              technologies: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>GitHub URL</label>
          <input
            type="url"
            className={INPUT_CLASS}
            value={project.githubUrl}
            onChange={(e) =>
              onChange({ ...project, githubUrl: e.target.value })
            }
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Live demo URL</label>
          <input
            type="url"
            className={INPUT_CLASS}
            value={project.liveDemoUrl}
            onChange={(e) =>
              onChange({ ...project, liveDemoUrl: e.target.value })
            }
          />
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={project.featured}
          onChange={(e) =>
            onChange({ ...project, featured: e.target.checked })
          }
        />
        Featured project
      </label>
    </div>
  );
}

function SkillsSection({
  data,
  locale,
  onChange,
}: {
  data: MasterProfileData;
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
}) {
  const group = data.skills[0];
  if (!group) return null;

  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <h3 className="text-lg font-extrabold text-primary">Skills</h3>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          onChange((d) => {
            const g = d.skills[0];
            if (!g) return d;
            return {
              ...d,
              skills: [
                {
                  ...g,
                  skills: [
                    ...g.skills,
                    {
                      id: `skill_${Date.now()}`,
                      name: { en: "", am: "" },
                      level: "intermediate",
                      yearsOfExperience: 1,
                      orderIndex: g.skills.length,
                    },
                  ],
                },
              ],
            };
          })
        }
      >
        <Plus className="h-4 w-4" />
        Add skill
      </Button>
      <div className="space-y-3">
        {group.skills.map((skill) => (
          <div
            key={skill.id}
            className="rounded-xl border border-primary/10 p-3"
          >
            <LocalizedInput
              label="Skill name"
              value={skill.name}
              locale={locale}
              onChange={(name) =>
                onChange((d) => ({
                  ...d,
                  skills: d.skills.map((sg) =>
                    sg.id === group.id
                      ? {
                        ...sg,
                        skills: sg.skills.map((s) =>
                          s.id === skill.id ? { ...s, name } : s,
                        ),
                      }
                      : sg,
                  ),
                }))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificationsSection({
  items,
  locale,
  onChange,
  onReorder,
}: {
  items: MasterProfileData["certifications"];
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
  onReorder: (from: number, to: number) => void;
}) {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-primary">Certifications</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange((d) => ({
              ...d,
              certifications: [
                ...d.certifications,
                createDefaultCertification(d.certifications.length),
              ],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <SortableList
        items={sorted}
        onReorder={onReorder}
        ariaLabel="Reorder certifications"
        renderItem={(cert) => (
          <div className="space-y-2">
            <LocalizedInput
              label="Certificate name"
              value={cert.certificateName}
              locale={locale}
              onChange={(certificateName) =>
                onChange((d) => ({
                  ...d,
                  certifications: d.certifications.map((c) =>
                    c.id === cert.id ? { ...c, certificateName } : c,
                  ),
                }))
              }
            />
            <div>
              <label className={LABEL_CLASS}>Issuer</label>
              <input
                type="text"
                className={INPUT_CLASS}
                value={cert.issuer}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    certifications: d.certifications.map((c) =>
                      c.id === cert.id ? { ...c, issuer: e.target.value } : c,
                    ),
                  }))
                }
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}

function ContactSection({
  data,
  locale,
  onChange,
}: {
  data: MasterProfileData;
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
}) {
  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <h3 className="text-lg font-extrabold text-primary">Contact</h3>
      {(["email", "phone", "website"] as const).map((field) => (
        <div key={field}>
          <label className={LABEL_CLASS}>
            {field.charAt(0).toUpperCase() + field.slice(1)}
          </label>
          <input
            type={field === "email" ? "email" : field === "website" ? "url" : "tel"}
            className={INPUT_CLASS}
            value={data.contact[field]}
            onChange={(e) =>
              onChange((d) => ({
                ...d,
                contact: { ...d.contact, [field]: e.target.value },
              }))
            }
          />
        </div>
      ))}
      <LocalizedInput
        label="Availability"
        value={data.contact.availability}
        locale={locale}
        onChange={(availability) =>
          onChange((d) => ({ ...d, contact: { ...d.contact, availability } }))
        }
      />
    </div>
  );
}

/* ====================== FIXED NEW SECTIONS ====================== */

function CaseStudiesSection({
  items,
  locale,
  onChange,
}: {
  items: any[];
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
}) {
  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-primary">Case Studies</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange((d) => ({
              ...d,
              caseStudies: [
                ...(d.caseStudies || []),
                {
                  id: `case_${Date.now()}`,
                  title: { en: "", am: "" },
                  imageUrl: "",
                  link: "",
                  orderIndex: (d.caseStudies?.length || 0),
                } as any,
              ],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add Case Study
        </Button>
      </div>
      <SortableList
        items={items}
        onReorder={() => { }}
        ariaLabel="Reorder case studies"
        renderItem={(item) => (
          <div className="space-y-3 p-4 border rounded-xl">
            <LocalizedInput
              label="Title"
              value={item.title}
              locale={locale}
              onChange={(title) =>
                onChange((d) => ({
                  ...d,
                  caseStudies: (d.caseStudies || []).map((cs) =>
                    cs.id === item.id ? { ...cs, title } : cs
                  ),
                }))
              }
            />
            <div>
              <label className={LABEL_CLASS}>Image URL</label>
              <input
                type="url"
                className={INPUT_CLASS}
                value={item.imageUrl || ""}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    caseStudies: (d.caseStudies || []).map((cs) =>
                      cs.id === item.id ? { ...cs, imageUrl: e.target.value } : cs
                    ),
                  }))
                }
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Link</label>
              <input
                type="url"
                className={INPUT_CLASS}
                value={item.link || ""}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    caseStudies: (d.caseStudies || []).map((cs) =>
                      cs.id === item.id ? { ...cs, link: e.target.value } : cs
                    ),
                  }))
                }
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}

function EducationSection({
  items,
  locale,
  onChange,
}: {
  items: any[];
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
}) {
  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-primary">Education</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange((d) => ({
              ...d,
              education: [
                ...(d.education || []),
                {
                  id: `edu_${Date.now()}`,
                  institution: { en: "", am: "" },
                  degree: { en: "", am: "" },
                  field: { en: "", am: "" },
                  startYear: "",
                  endYear: "",
                  orderIndex: (d.education?.length || 0),
                } as any,
              ],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add Education
        </Button>
      </div>
      <SortableList
        items={items}
        onReorder={() => { }}
        ariaLabel="Reorder education"
        renderItem={(item) => (
          <div className="space-y-3 p-4 border rounded-xl">
            <LocalizedInput
              label="Institution"
              value={item.institution}
              locale={locale}
              onChange={(institution) =>
                onChange((d) => ({
                  ...d,
                  education: (d.education || []).map((edu) =>
                    edu.id === item.id ? { ...edu, institution } : edu
                  ),
                }))
              }
            />
            <LocalizedInput
              label="Degree"
              value={item.degree}
              locale={locale}
              onChange={(degree) =>
                onChange((d) => ({
                  ...d,
                  education: (d.education || []).map((edu) =>
                    edu.id === item.id ? { ...edu, degree } : edu
                  ),
                }))
              }
            />
            <LocalizedInput
              label="Field of Study"
              value={item.field}
              locale={locale}
              onChange={(field) =>
                onChange((d) => ({
                  ...d,
                  education: (d.education || []).map((edu) =>
                    edu.id === item.id ? { ...edu, field } : edu
                  ),
                }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Start Year</label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  value={item.startYear || ""}
                  placeholder="2020"
                  onChange={(e) =>
                    onChange((d) => ({
                      ...d,
                      education: (d.education || []).map((edu) =>
                        edu.id === item.id ? { ...edu, startYear: e.target.value } : edu
                      ),
                    }))
                  }
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>End Year</label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  value={item.endYear || ""}
                  placeholder="2024"
                  onChange={(e) =>
                    onChange((d) => ({
                      ...d,
                      education: (d.education || []).map((edu) =>
                        edu.id === item.id ? { ...edu, endYear: e.target.value } : edu
                      ),
                    }))
                  }
                />
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

function ExperienceSection({
  items,
  locale,
  onChange,
}: {
  items: any[];
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
}) {
  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-primary">Experience</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange((d) => ({
              ...d,
              experience: [
                ...(d.experience || []),
                {
                  id: `exp_${Date.now()}`,
                  company: { en: "", am: "" },
                  position: { en: "", am: "" },
                  description: { en: "", am: "" },
                  startDate: "",
                  endDate: "",
                  orderIndex: (d.experience?.length || 0),
                } as any,
              ],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add Experience
        </Button>
      </div>
      <SortableList
        items={items}
        onReorder={() => { }}
        ariaLabel="Reorder experience"
        renderItem={(item) => (
          <div className="space-y-3 p-4 border rounded-xl">
            <LocalizedInput
              label="Company"
              value={item.company}
              locale={locale}
              onChange={(company) =>
                onChange((d) => ({
                  ...d,
                  experience: (d.experience || []).map((exp) =>
                    exp.id === item.id ? { ...exp, company } : exp
                  ),
                }))
              }
            />
            <LocalizedInput
              label="Position"
              value={item.position}
              locale={locale}
              onChange={(position) =>
                onChange((d) => ({
                  ...d,
                  experience: (d.experience || []).map((exp) =>
                    exp.id === item.id ? { ...exp, position } : exp
                  ),
                }))
              }
            />
            <LocalizedInput
              label="Description"
              value={item.description}
              locale={locale}
              onChange={(description) =>
                onChange((d) => ({
                  ...d,
                  experience: (d.experience || []).map((exp) =>
                    exp.id === item.id ? { ...exp, description } : exp
                  ),
                }))
              }
              multiline
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Start Date</label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  value={item.startDate || ""}
                  onChange={(e) =>
                    onChange((d) => ({
                      ...d,
                      experience: (d.experience || []).map((exp) =>
                        exp.id === item.id ? { ...exp, startDate: e.target.value } : exp
                      ),
                    }))
                  }
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>End Date</label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  value={item.endDate || ""}
                  onChange={(e) =>
                    onChange((d) => ({
                      ...d,
                      experience: (d.experience || []).map((exp) =>
                        exp.id === item.id ? { ...exp, endDate: e.target.value } : exp
                      ),
                    }))
                  }
                />
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

function SocialLinksSection({
  items,
  locale,
  onChange,
}: {
  items: any[];
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
}) {
  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-primary">Social Links</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange((d) => ({
              ...d,
              socialLinks: [
                ...(d.socialLinks || []),
                {
                  id: `link_${Date.now()}`,
                  platform: "",
                  url: "",
                  orderIndex: (d.socialLinks?.length || 0),
                } as any,
              ],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add Link
        </Button>
      </div>
      <div className="space-y-3">
        {(items || []).map((link) => (
          <div key={link.id} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className={LABEL_CLASS}>Platform</label>
              <input
                type="text"
                className={INPUT_CLASS}
                value={link.platform}
                placeholder="LinkedIn, Twitter, etc."
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    socialLinks: (d.socialLinks || []).map((l) =>
                      l.id === link.id ? { ...l, platform: e.target.value } : l
                    ),
                  }))
                }
              />
            </div>
            <div className="flex-1">
              <label className={LABEL_CLASS}>URL</label>
              <input
                type="url"
                className={INPUT_CLASS}
                value={link.url}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    socialLinks: (d.socialLinks || []).map((l) =>
                      l.id === link.id ? { ...l, url: e.target.value } : l
                    ),
                  }))
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                onChange((d) => ({
                  ...d,
                  socialLinks: (d.socialLinks || []).filter((l) => l.id !== link.id),
                }))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GallerySection({
  items,
  locale,
  onChange,
  onReorder,
}: {
  items: MasterProfileData["gallery"];
  locale: LanguageCode;
  onChange: SectionEditorProps["onChange"];
  onReorder: (from: number, to: number) => void;
}) {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className={`${SECTION_CARD_CLASS} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-primary">Gallery</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange((d) => ({
              ...d,
              gallery: [
                ...d.gallery,
                {
                  id: `gallery_${Date.now()}`,
                  title: { en: "", am: "" },
                  caption: { en: "", am: "" },
                  imageUrl: "",
                  orderIndex: d.gallery.length,
                } as any,
              ],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Add Image
        </Button>
      </div>

      <SortableList
        items={sorted}
        onReorder={onReorder}
        ariaLabel="Reorder gallery items"
        renderItem={(item) => (
          <div className="space-y-3 p-4 border rounded-xl">
            <LocalizedInput
              label="Title"
              value={item.title}
              locale={locale}
              onChange={(title) =>
                onChange((d) => ({
                  ...d,
                  gallery: d.gallery.map((g) =>
                    g.id === item.id ? { ...g, title } : g
                  ),
                }))
              }
            />
            <LocalizedInput
              label="Caption"
              value={item.caption}
              locale={locale}
              onChange={(caption) =>
                onChange((d) => ({
                  ...d,
                  gallery: d.gallery.map((g) =>
                    g.id === item.id ? { ...g, caption } : g
                  ),
                }))
              }
            />
            <div>
              <label className={LABEL_CLASS}>Image URL</label>
              <input
                type="url"
                className={INPUT_CLASS}
                value={item.imageUrl}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    gallery: d.gallery.map((g) =>
                      g.id === item.id ? { ...g, imageUrl: e.target.value } : g
                    ),
                  }))
                }
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}