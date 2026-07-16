'use client';

import { useState } from 'react';
import {
  Award,
  Briefcase,
  Check,
  GraduationCap,
  Languages,
  Loader2,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { autofillProfile, deleteResume, messageFromResumeBrainError } from './api';
import { ResumeBrainLocale, useResumeBrainI18n } from './i18n';
import {
  EducationEntry,
  ExtractedResume,
  LanguageEntry,
  PersonalInfo,
  WorkExperienceEntry,
} from './types';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brandGreen focus:ring-2 focus:ring-brandGreen/10';

export interface ParsedResumePreviewProps {
  /** The extracted resume data to review, as returned by the upload endpoint. */
  resume: ExtractedResume;
  /** `ParsedResume` ID this data came from — sent back to the autofill endpoint. */
  resumeId: string;
  /** The professional's user ID (used as the `:id` in `PATCH /profiles/:id/autofill`). */
  userId: string;
  /** Called once the profile has been successfully autofilled. */
  onAutofilled?: (updatedProfile: unknown) => void;
  /** Locale used by the Resume Brain UI strings. */
  locale?: ResumeBrainLocale;
}

/**
 * Editable review form for AI-extracted CV data. The professional can
 * confirm or correct any field before it is applied to their profile.
 * Personal info and skills edits are sent to the backend and applied;
 * education/experience/certifications/languages remain visible for review
 * and stay attached to the stored parsed resume (the platform profile does
 * not yet have dedicated columns for them).
 */
export function ParsedResumePreview({
  resume,
  resumeId,
  userId,
  onAutofilled,
  locale = 'en',
}: ParsedResumePreviewProps) {
  const { t } = useResumeBrainI18n(locale);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(resume.personalInfo);
  const [education, setEducation] = useState<EducationEntry[]>(resume.education);
  const [workExperience, setWorkExperience] = useState<WorkExperienceEntry[]>(
    resume.workExperience,
  );
  const [skills, setSkills] = useState<string[]>(resume.skills);
  const [certifications, setCertifications] = useState<string[]>(resume.certifications);
  const [languages, setLanguages] = useState<LanguageEntry[]>(resume.languages);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePersonalInfo<K extends keyof PersonalInfo>(key: K, value: string) {
    setPersonalInfo((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  function updateEducation(index: number, key: keyof EducationEntry, value: string) {
    setEducation((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    );
  }

  function updateExperience(index: number, key: keyof WorkExperienceEntry, value: string) {
    setWorkExperience((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    );
  }

  function updateLanguage(index: number, key: keyof LanguageEntry, value: string) {
    setLanguages((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    );
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    setDeleteSuccess(false);
    setError(null);
    try {
      const updatedProfile = await autofillProfile(userId, resumeId, { personalInfo, skills });
      setSuccess(true);
      onAutofilled?.(updatedProfile);
    } catch (err) {
      setError(messageFromResumeBrainError(err, t('errorGeneric')));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setSuccess(false);
    setError(null);
    try {
      await deleteResume(resumeId);
      setDeleteSuccess(true);
    } catch (err) {
      setError(messageFromResumeBrainError(err, t('errorGeneric')));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-primary">{t('previewTitle')}</h2>
        <p className="mt-1 text-xs text-muted">{t('previewSubtitle')}</p>
      </div>

      <Section icon={UserRound} title={t('personalInfoSection')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('fullNameLabel')}
            value={personalInfo.fullName ?? ''}
            onChange={(v) => updatePersonalInfo('fullName', v)}
          />
          <Field
            label={t('emailLabel')}
            value={personalInfo.email ?? ''}
            onChange={(v) => updatePersonalInfo('email', v)}
          />
          <Field
            label={t('phoneLabel')}
            value={personalInfo.phone ?? ''}
            onChange={(v) => updatePersonalInfo('phone', v)}
          />
          <Field
            label={t('locationLabel')}
            value={personalInfo.location ?? ''}
            onChange={(v) => updatePersonalInfo('location', v)}
          />
        </div>
      </Section>

      <Section icon={GraduationCap} title={t('educationSection')}>
        {education.length === 0 ? (
          <EmptyState text={t('noEducation')} />
        ) : (
          <div className="space-y-4">
            {education.map((entry, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-2xl border border-primary/10 bg-[#f7f5ef] p-4 sm:grid-cols-2"
              >
                <Field
                  label={t('institutionLabel')}
                  value={entry.institution ?? ''}
                  onChange={(v) => updateEducation(index, 'institution', v)}
                />
                <Field
                  label={t('degreeLabel')}
                  value={entry.degree ?? ''}
                  onChange={(v) => updateEducation(index, 'degree', v)}
                />
                <Field
                  label={t('fieldOfStudyLabel')}
                  value={entry.fieldOfStudy ?? ''}
                  onChange={(v) => updateEducation(index, 'fieldOfStudy', v)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label={t('startDateLabel')}
                    value={entry.startDate ?? ''}
                    onChange={(v) => updateEducation(index, 'startDate', v)}
                  />
                  <Field
                    label={t('endDateLabel')}
                    value={entry.endDate ?? ''}
                    onChange={(v) => updateEducation(index, 'endDate', v)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Briefcase} title={t('workExperienceSection')}>
        {workExperience.length === 0 ? (
          <EmptyState text={t('noExperience')} />
        ) : (
          <div className="space-y-4">
            {workExperience.map((entry, index) => (
              <div key={index} className="rounded-2xl border border-primary/10 bg-[#f7f5ef] p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={t('companyLabel')}
                    value={entry.company ?? ''}
                    onChange={(v) => updateExperience(index, 'company', v)}
                  />
                  <Field
                    label={t('titleLabel')}
                    value={entry.title ?? ''}
                    onChange={(v) => updateExperience(index, 'title', v)}
                  />
                  <Field
                    label={t('startDateLabel')}
                    value={entry.startDate ?? ''}
                    onChange={(v) => updateExperience(index, 'startDate', v)}
                  />
                  <Field
                    label={t('endDateLabel')}
                    value={entry.endDate ?? ''}
                    onChange={(v) => updateExperience(index, 'endDate', v)}
                  />
                </div>
                <label className="mt-3 block text-xs font-bold text-ink">
                  {t('descriptionLabel')}
                  <textarea
                    rows={3}
                    value={entry.description ?? ''}
                    onChange={(e) => updateExperience(index, 'description', e.target.value)}
                    className={inputClass}
                  />
                </label>
                {entry.compensation?.amount && entry.compensation.currencyCode && (
                  <p className="mt-3 text-[11px] text-muted/90">
                    <span className="font-semibold">{t('compensationLabel')}:</span>{' '}
                    {entry.compensation.amount} {entry.compensation.currencyCode}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section icon={Award} title={t('skillsSection')}>
          <TagList items={skills} onChange={setSkills} emptyText={t('noSkills')} locale={locale} />
        </Section>
        <Section icon={Award} title={t('certificationsSection')}>
          <TagList
            items={certifications}
            onChange={setCertifications}
            emptyText={t('noCertifications')}
            locale={locale}
          />
        </Section>
      </div>

      <Section icon={Languages} title={t('languagesSection')}>
        {languages.length === 0 ? (
          <EmptyState text={t('noLanguages')} />
        ) : (
          <div className="space-y-3">
            {languages.map((entry, index) => (
              <div key={index} className="grid grid-cols-2 gap-3">
                <Field
                  label={t('languageLabel')}
                  value={entry.language ?? ''}
                  onChange={(v) => updateLanguage(index, 'language', v)}
                />
                <Field
                  label={t('proficiencyLabel')}
                  value={entry.proficiency ?? ''}
                  onChange={(v) => updateLanguage(index, 'proficiency', v)}
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-redAccent/10 px-4 py-3 text-sm font-semibold text-redAccent"
        >
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl bg-brandGreen/10 px-4 py-3 text-sm font-semibold text-brandGreen">
          {t('autofillSuccess')}
        </p>
      )}
      {deleteSuccess && (
        <p className="rounded-xl bg-brandGreen/10 px-4 py-3 text-sm font-semibold text-brandGreen">
          {t('deleteSuccess')}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSubmitting || isDeleting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brandGreen disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {isSubmitting ? t('autofilling') : t('confirmButton')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting || isDeleting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-redAccent/20 bg-white px-4 py-2.5 text-xs font-bold text-redAccent transition hover:bg-redAccent/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {isDeleting ? t('deleting') : t('deleteResumeButton')}
        </button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d8ff3e] text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-extrabold text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs font-bold text-ink">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs italic text-muted/60">{text}</p>;
}

function TagList({
  items,
  onChange,
  emptyText,
  locale,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  emptyText: string;
  locale: ResumeBrainLocale;
}) {
  const { t } = useResumeBrainI18n(locale);
  return (
    <div>
      {items.length === 0 && <EmptyState text={emptyText} />}
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brandGreen/10 px-3 py-1 text-[11px] font-bold text-brandGreen"
          >
            {item}
            <button
              type="button"
              aria-label={t('removeEntry')}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="text-brandGreen/70 hover:text-redAccent"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brandGreen"
      >
        <Plus className="h-3.5 w-3.5" /> {t('addEntry')}
      </button>
    </div>
  );
}
