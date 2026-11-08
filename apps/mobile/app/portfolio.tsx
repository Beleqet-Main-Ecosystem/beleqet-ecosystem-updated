import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, H2, Muted, Field, Select, Chips, Button, Notice, Toggle, Loading, Failed, Divider } from '../components/ui';
import { get, send } from '../lib/api';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { safeHttpUrl } from '../lib/format';

/**
 * The portfolio ("master profile") the website's builder edits, stored at /users/portfolio.
 * The phone edits the main sections; case studies and the gallery are kept as they are.
 */
type L = { en: string; am: string };
type Row = Record<string, unknown> & { id: string; orderIndex: number };
type Portfolio = {
  version: 1;
  templateId: string;
  industries: string[];
  sectionOrder: string[];
  profile: { fullName: string; headline: L; jobTitle: L; avatarUrl: string; location: string };
  summary: L;
  projects: Row[];
  caseStudies: Row[];
  skills: { id: string; category: string; orderIndex: number; skills: Row[] }[];
  certifications: Row[];
  education: Row[];
  experience: Row[];
  socialLinks: Row[];
  gallery: Row[];
  contact: { email: string; phone: string; website: string; availability: L };
  meta: { published: boolean; updatedAt: string };
};

const SECTION_ORDER = ['profile', 'summary', 'projects', 'caseStudies', 'skills', 'certifications', 'education', 'experience', 'socialLinks', 'gallery', 'contact'];
const TEMPLATES = ['modern', 'minimal', 'professional', 'creative'];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const empty = (): L => ({ en: '', am: '' });
const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function blank(): Portfolio {
  return {
    version: 1,
    templateId: 'modern',
    industries: [],
    sectionOrder: [...SECTION_ORDER],
    profile: { fullName: '', headline: empty(), jobTitle: empty(), avatarUrl: '', location: '' },
    summary: empty(),
    projects: [],
    caseStudies: [],
    skills: [{ id: id('skill_group'), category: 'other', orderIndex: 0, skills: [] }],
    certifications: [],
    education: [],
    experience: [],
    socialLinks: [],
    gallery: [],
    contact: { email: '', phone: '', website: '', availability: empty() },
    meta: { published: false, updatedAt: new Date().toISOString() },
  };
}

async function fetchPortfolio(): Promise<Portfolio | null> {
  const body = await get<{ data?: unknown } | '' | null>('/users/portfolio').catch(() => null);
  const raw = (body && typeof body === 'object' && 'data' in body ? body.data : body) as Partial<Portfolio> | null;
  return raw && raw.version === 1 && raw.profile && raw.sectionOrder ? (raw as Portfolio) : null;
}

/** A field kind for the generic list editor. */
type FieldSpec = { key: string; label: string; localized?: boolean; multiline?: boolean; url?: boolean; list?: boolean };

export default function PortfolioScreen() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const load = useLoad(fetchPortfolio, [], { enabled: Boolean(user) });
  const [data, setData] = useState<Portfolio | null>(null);
  const [lang, setLang] = useState<'en' | 'am'>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!load.loading && !load.error) {
      setData(load.data ?? {
        ...blank(),
        profile: { ...blank().profile, fullName: user ? `${user.firstName} ${user.lastName}`.trim() : '', location: user?.location ?? '' },
        contact: { ...blank().contact, email: user?.email ?? '' },
      });
    }
  }, [load.loading, load.error, load.data, user]);

  if (!user) {
    return (
      <Screen title={t('m.tools.portfolio')}>
        <Button label={t('auth.signIn')} onPress={() => router.replace({ pathname: '/(auth)/login', params: { next: '/portfolio' } })} />
      </Screen>
    );
  }
  if (load.loading || (!data && !load.error)) return <Screen title={t('m.tools.portfolio')}><Loading /></Screen>;
  if (load.error || !data) return <Screen title={t('m.tools.portfolio')}><Failed message={errorText(load.error, t)} onRetry={load.reload} /></Screen>;

  const set = (patch: Partial<Portfolio>) => {
    setData({ ...data, ...patch });
    setNotice('');
  };
  const loc = (value: L | undefined, next: string): L => ({ ...(value ?? empty()), [lang]: next });

  async function save(publish?: boolean) {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      const next = { ...data, meta: { published: publish ?? data.meta.published, updatedAt: new Date().toISOString() } };
      await send('PUT', '/users/portfolio', { data: next });
      setData(next);
      setNotice(t(publish ? 'm.portfolio.published' : 'm.portfolio.saved'));
    } catch (failure) {
      setError(errorText(failure, t, 'dash.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  /** Edits one list section (projects, experience …) with the given fields. */
  const listSection = (key: 'projects' | 'experience' | 'education' | 'certifications' | 'socialLinks', title: string, fields: FieldSpec[], make: () => Row) => {
    const rows = data[key];
    const update = (rowId: string, field: FieldSpec, value: string) =>
      set({
        [key]: rows.map((row) => {
          if (row.id !== rowId) return row;
          if (field.localized) return { ...row, [field.key]: loc(row[field.key] as L, value) };
          if (field.list) return { ...row, [field.key]: value.split(',').map((item) => item.trim()).filter(Boolean) };
          return { ...row, [field.key]: value };
        }),
      } as Partial<Portfolio>);
    return (
      <Card>
        <H2>{title}</H2>
        {rows.map((row, index) => (
          <View key={row.id} className="gap-3">
            {index > 0 ? <Divider /> : null}
            {fields.map((field) => {
              const raw = row[field.key];
              const value = field.localized ? ((raw as L | undefined)?.[lang] ?? '') : field.list ? ((raw as string[] | undefined) ?? []).join(', ') : String(raw ?? '');
              return (
                <Field
                  key={field.key}
                  label={field.label}
                  value={value}
                  onChangeText={(next) => update(row.id, field, next)}
                  multiline={field.multiline}
                  autoCapitalize={field.url ? 'none' : 'sentences'}
                  keyboardType={field.url ? 'url' : 'default'}
                  error={field.url && value && !safeHttpUrl(value) ? t('job.apply.portfolioInvalid') : undefined}
                />
              );
            })}
            <Button small variant="ghost" label={t('dash.remove')} onPress={() => set({ [key]: rows.filter((item) => item.id !== row.id) } as Partial<Portfolio>)} />
          </View>
        ))}
        <Button small variant="outline" label={`+ ${t('dash.add')}`} onPress={() => set({ [key]: [...rows, { ...make(), orderIndex: rows.length }] } as Partial<Portfolio>)} />
      </Card>
    );
  };

  const group = data.skills[0] ?? { id: id('skill_group'), category: 'other', orderIndex: 0, skills: [] };
  const setSkills = (skills: Row[]) => set({ skills: [{ ...group, skills }, ...data.skills.slice(1)] });

  return (
    <Screen
      title={t('m.tools.portfolio')}
      footer={
        <View className="flex-row gap-2">
          <Button className="flex-1" variant="outline" label={t('postJob.save')} busy={busy} onPress={() => save()} />
          <Button className="flex-1" label={data.meta.published ? t('m.portfolio.unpublish') : t('m.portfolio.publish')} busy={busy} onPress={() => save(!data.meta.published)} />
        </View>
      }
    >
      <Muted>{t('m.portfolio.intro')}</Muted>
      <Notice tone={data.meta.published ? 'good' : 'info'} text={t(data.meta.published ? 'm.portfolio.isPublished' : 'm.portfolio.isDraft')} />
      {error ? <Notice tone="bad" text={error} /> : null}
      {notice ? <Notice tone="good" text={notice} /> : null}

      <Card>
        <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('m.portfolio.contentLanguage')}</Text>
        <Chips value={lang} onChange={(value) => setLang(value as 'en' | 'am')} options={[{ value: 'en', label: 'English' }, { value: 'am', label: 'አማርኛ' }]} />
        <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('m.portfolio.template')}</Text>
        <Chips value={data.templateId} onChange={(templateId) => set({ templateId })} options={TEMPLATES.map((value) => ({ value, label: t(`m.portfolio.templates.${value}`) }))} />
      </Card>

      <Card>
        <H2>{t('m.portfolio.profile')}</H2>
        <Field label={t('cv.fullName')} value={data.profile.fullName} onChangeText={(fullName) => set({ profile: { ...data.profile, fullName } })} />
        <Field label={t('cv.jobTitle')} value={data.profile.jobTitle[lang]} onChangeText={(v) => set({ profile: { ...data.profile, jobTitle: loc(data.profile.jobTitle, v) } })} />
        <Field label={t('dash.fields.headline')} value={data.profile.headline[lang]} onChangeText={(v) => set({ profile: { ...data.profile, headline: loc(data.profile.headline, v) } })} />
        <Field label={t('cv.location')} value={data.profile.location} onChangeText={(location) => set({ profile: { ...data.profile, location } })} />
      </Card>

      <Card>
        <H2>{t('cv.sections.summary')}</H2>
        <Field value={data.summary[lang]} onChangeText={(v) => set({ summary: loc(data.summary, v) })} multiline />
      </Card>

      {listSection('projects', t('m.portfolio.projects'), [
        { key: 'title', label: t('m.portfolio.projectTitle'), localized: true },
        { key: 'description', label: t('cv.whatYouDid'), localized: true, multiline: true },
        { key: 'technologies', label: t('m.portfolio.technologies'), list: true },
        { key: 'liveDemoUrl', label: t('m.portfolio.liveLink'), url: true },
        { key: 'githubUrl', label: 'GitHub', url: true },
      ], () => ({ id: id('project'), orderIndex: 0, title: empty(), description: empty(), technologies: [], images: [], links: [], githubUrl: '', liveDemoUrl: '', tags: [], featured: false }))}

      <Card>
        <H2>{t('cv.skillsHeading')}</H2>
        {group.skills.map((skill) => (
          <View key={skill.id} className="gap-2">
            <Field label={t('m.portfolio.skill')} value={(skill.name as L)?.[lang] ?? ''} onChangeText={(v) => setSkills(group.skills.map((s) => (s.id === skill.id ? { ...s, name: loc(s.name as L, v) } : s)))} />
            <Select label={t('m.portfolio.level')} value={String(skill.level ?? 'intermediate')} onChange={(level) => setSkills(group.skills.map((s) => (s.id === skill.id ? { ...s, level } : s)))} options={LEVELS.map((value) => ({ value, label: t(`m.portfolio.levels.${value}`) }))} />
            <Button small variant="ghost" label={t('dash.remove')} onPress={() => setSkills(group.skills.filter((s) => s.id !== skill.id))} />
          </View>
        ))}
        <Button small variant="outline" label={`+ ${t('dash.add')}`} onPress={() => setSkills([...group.skills, { id: id('skill'), name: empty(), level: 'intermediate', yearsOfExperience: 1, orderIndex: group.skills.length }])} />
      </Card>

      {listSection('experience', t('cv.experienceHeading'), [
        { key: 'role', label: t('cv.role'), localized: true },
        { key: 'company', label: t('cv.company'), localized: true },
        { key: 'location', label: t('cv.location') },
        { key: 'startDate', label: t('cv.start') },
        { key: 'endDate', label: t('cv.end') },
        { key: 'description', label: t('cv.whatYouDid'), localized: true, multiline: true },
      ], () => ({ id: id('experience'), orderIndex: 0, role: empty(), company: empty(), location: '', startDate: '', endDate: '', description: empty() }))}

      {listSection('education', t('cv.sections.education'), [
        { key: 'institution', label: t('cv.school'), localized: true },
        { key: 'degree', label: t('cv.qualification'), localized: true },
        { key: 'field', label: t('m.portfolio.field'), localized: true },
        { key: 'startYear', label: t('cv.start') },
        { key: 'endYear', label: t('cv.year') },
      ], () => ({ id: id('education'), orderIndex: 0, institution: empty(), degree: empty(), field: empty(), startYear: '', endYear: '', description: empty() }))}

      {listSection('certifications', t('m.portfolio.certifications'), [
        { key: 'certificateName', label: t('m.portfolio.certificate'), localized: true },
        { key: 'issuer', label: t('m.portfolio.issuer') },
        { key: 'issueDate', label: t('m.portfolio.issued') },
        { key: 'credentialUrl', label: t('m.portfolio.credentialLink'), url: true },
      ], () => ({ id: id('cert'), orderIndex: 0, issuer: '', certificateName: empty(), credentialUrl: '', issueDate: '', expiryDate: '' }))}

      {listSection('socialLinks', t('m.portfolio.links'), [
        { key: 'platform', label: t('m.portfolio.platform') },
        { key: 'url', label: 'URL', url: true },
      ], () => ({ id: id('social'), orderIndex: 0, platform: '', url: '' }))}

      <Card>
        <H2>{t('m.portfolio.contact')}</H2>
        <Field label={t('cv.email')} value={data.contact.email} onChangeText={(email) => set({ contact: { ...data.contact, email } })} keyboardType="email-address" autoCapitalize="none" />
        <Field label={t('cv.phone')} value={data.contact.phone} onChangeText={(phone) => set({ contact: { ...data.contact, phone } })} keyboardType="phone-pad" />
        <Field label={t('cv.website')} value={data.contact.website} onChangeText={(website) => set({ contact: { ...data.contact, website } })} keyboardType="url" autoCapitalize="none" />
        <Field label={t('m.portfolio.availability')} value={data.contact.availability[lang]} onChangeText={(v) => set({ contact: { ...data.contact, availability: loc(data.contact.availability, v) } })} />
        <Toggle label={t('m.portfolio.publicLabel')} hint={t('m.portfolio.publicHint')} value={data.meta.published} onChange={(published) => set({ meta: { ...data.meta, published } })} />
      </Card>
      {data.caseStudies.length > 0 || data.gallery.length > 0 ? <Muted>{t('m.portfolio.webOnly')}</Muted> : null}
    </Screen>
  );
}
