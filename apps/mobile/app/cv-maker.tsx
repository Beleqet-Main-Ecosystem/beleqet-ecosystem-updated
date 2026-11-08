import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ChevronDown, ChevronUp, Download, Sparkles } from 'lucide-react-native';
import { Screen, Card, Muted, Field, Button, Notice } from '../components/ui';
import { buildProfilePayload, emptyCv, mergeExtractedProfile, resumeToCvImport, type CvData, type Education, type Experience } from '../features/cv-mapping';
import { useCvImport } from '../lib/cv-import';
import { get, send } from '../lib/api';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { errorText } from '../lib/api-error';
import { SITE_URL } from '../lib/config';

const LOCAL_DRAFT = 'beleqet_cv_draft';
const SECTIONS = ['contact', 'summary', 'experience', 'education', 'skills'] as const;
type SectionId = (typeof SECTIONS)[number];

const split = (list: string) => list.split(',').map((item) => item.trim()).filter(Boolean);
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The CV as a printable page, matching the website's preview. */
function cvHtml(cv: CvData, t: (key: string) => string) {
  const contact = [cv.email, cv.phone, cv.location, cv.website].filter(Boolean).map(escape).join(' · ');
  const jobs = cv.experience.filter((item) => item.role || item.company);
  const schools = cv.education.filter((item) => item.school || item.qualification);
  const skills = split(cv.skills);
  const languages = split(cv.languages);
  const heading = (text: string) => `<h2>${escape(text)}</h2>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,'Noto Sans Ethiopic',sans-serif;color:#121922;padding:36px;font-size:12pt;line-height:1.45}
    h1{margin:0;font-size:24pt} .title{color:#00653B;font-weight:700;margin:4px 0} .contact{color:#4D5967;font-size:10pt}
    h2{font-size:11pt;text-transform:uppercase;letter-spacing:.06em;color:#00653B;border-bottom:1px solid #E3E8EC;padding-bottom:4px;margin-top:22px}
    .row{display:flex;justify-content:space-between;font-weight:700} .muted{color:#4D5967} p{margin:4px 0 10px}
  </style></head><body>
    <h1>${escape(cv.fullName || t('cv.yourName'))}</h1>
    ${cv.title ? `<div class="title">${escape(cv.title)}</div>` : ''}
    ${contact ? `<div class="contact">${contact}</div>` : ''}
    ${cv.summary.trim() ? `${heading(t('cv.sections.summary'))}<p>${escape(cv.summary)}</p>` : ''}
    ${jobs.length ? `${heading(t('cv.experienceHeading'))}${jobs.map((job) => `<div class="row"><span>${escape([job.role, job.company].filter(Boolean).join(' · '))}</span><span class="muted">${escape([job.start, job.end].filter(Boolean).join(' – '))}</span></div><p>${escape(job.description)}</p>`).join('')}` : ''}
    ${schools.length ? `${heading(t('cv.sections.education'))}${schools.map((school) => `<div class="row"><span>${escape([school.qualification, school.school].filter(Boolean).join(' · '))}</span><span class="muted">${escape(school.year)}</span></div>`).join('')}` : ''}
    ${skills.length ? `${heading(t('cv.skillsHeading'))}<p>${skills.map(escape).join(' · ')}</p>` : ''}
    ${languages.length ? `${heading(t('cv.languages'))}<p>${languages.map(escape).join(' · ')}</p>` : ''}
  </body></html>`;
}

/** Build a CV: same sections and saving as the website, plus a PDF to share from the phone. */
export default function CvMaker() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const pending = useCvImport((s) => s.pending);
  const clearImport = useCvImport((s) => s.set);
  // A CV handed over by Resume Brain starts the form; otherwise the saved draft loads below.
  const [imported] = useState(() => (pending ? mergeExtractedProfile(emptyCv, resumeToCvImport(pending)).next : null));
  const [cv, setCv] = useState<CvData>(imported ?? emptyCv);
  const [open, setOpen] = useState<Record<SectionId, boolean>>(imported ? { contact: true, summary: true, experience: true, education: true, skills: true } : { contact: true, summary: true, experience: true, education: false, skills: false });
  const [status, setStatus] = useState(imported ? t('cv.imported') : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'draft' | 'profile' | 'ai' | 'pdf'>('');
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (imported) {
      clearImport(null);
      return;
    }
    if (user) {
      get<{ data?: CvData } | '' | null>('/users/cv-draft')
        .then((draft) => {
          if (draft && draft.data) setCv(draft.data);
        })
        .catch(() => undefined);
    } else {
      SecureStore.getItemAsync(LOCAL_DRAFT)
        .then((raw) => {
          if (raw) setCv(JSON.parse(raw) as CvData);
        })
        .catch(() => undefined);
    }
  }, [imported, user, clearImport]);

  function field<K extends keyof CvData>(key: K, value: CvData[K]) {
    setCv((old) => ({ ...old, [key]: value }));
    setStatus('');
  }
  const updateJob = (id: number, key: keyof Experience, value: string) => field('experience', cv.experience.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  const updateSchool = (id: number, key: keyof Education, value: string) => field('education', cv.education.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  const nextId = (list: { id: number }[]) => Math.max(0, ...list.map((item) => item.id)) + 1;

  async function saveDraft() {
    setBusy('draft');
    setError('');
    try {
      if (user) await send('PUT', '/users/cv-draft', { data: cv });
      else await SecureStore.setItemAsync(LOCAL_DRAFT, JSON.stringify(cv));
      setStatus(t('cv.draftSaved'));
    } catch (failure) {
      setError(errorText(failure, t, 'cv.draftFailed'));
    } finally {
      setBusy('');
    }
  }

  async function saveToProfile() {
    setError('');
    if (!user) return setError(t('cv.signInToSave'));
    const payload = buildProfilePayload(cv);
    if (Object.keys(payload).length === 0) return setError(t('cv.nothingToSave'));
    setBusy('profile');
    try {
      await send('PATCH', '/users/profile', payload);
      setStatus(t('cv.profileSaved'));
    } catch (failure) {
      setError(errorText(failure, t, 'cv.profileFailed'));
    } finally {
      setBusy('');
    }
  }

  async function writeSummary() {
    setBusy('ai');
    setError('');
    try {
      // The website's own summary writer (a Next.js route on beleqetjobs.com).
      const response = await fetch(`${SITE_URL}/api/cv-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: cv.fullName, title: cv.title, skills: cv.skills, experience: cv.experience.map(({ role, company, description }) => ({ role, company, description })) }),
      });
      const data = (await response.json().catch(() => ({}))) as { summary?: string };
      if (response.status === 400) throw new Error(t('cv.aiNeedsDetails'));
      if (!response.ok || !data.summary) throw new Error(t('cv.aiFailed'));
      field('summary', data.summary);
    } catch (failure) {
      setError(failure instanceof Error && failure.message !== 'Network request failed' ? failure.message : t('errors.offline'));
    } finally {
      setBusy('');
    }
  }

  async function downloadPdf() {
    setBusy('pdf');
    setError('');
    try {
      const { uri } = await Print.printToFileAsync({ html: cvHtml(cv, t) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('cv.download'), UTI: 'com.adobe.pdf' });
    } catch {
      setError(t('m.cv.pdfFailed'));
    } finally {
      setBusy('');
    }
  }

  const jobs = cv.experience.filter((item) => item.role || item.company);
  const schools = cv.education.filter((item) => item.school || item.qualification);
  const skills = split(cv.skills);
  const summaries: Record<SectionId, string> = {
    contact: cv.fullName || t('cv.notStarted'),
    summary: t(cv.summary.trim() ? 'cv.done' : 'cv.empty'),
    experience: t(jobs.length === 1 ? 'cv.oneJob' : 'cv.jobs', { count: jobs.length }),
    education: t(schools.length === 1 ? 'cv.oneEntry' : 'cv.entries', { count: schools.length }),
    skills: t(skills.length === 1 ? 'cv.oneSkill' : 'cv.skillCount', { count: skills.length }),
  };

  const section = (id: SectionId, body: ReactNode) => (
    <Card key={id}>
      <Pressable onPress={() => setOpen({ ...open, [id]: !open[id] })} accessibilityRole="button" accessibilityState={{ expanded: open[id] }} className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-ink-900 dark:text-white">{t(`cv.sections.${id}`)}</Text>
          <Muted>{summaries[id]}</Muted>
        </View>
        {open[id] ? <ChevronUp color={colors.muted} size={20} /> : <ChevronDown color={colors.muted} size={20} />}
      </Pressable>
      {open[id] ? body : null}
    </Card>
  );

  return (
    <Screen
      title={t('cv.title')}
      footer={
        <View className="flex-row gap-2">
          <Button className="flex-1" small variant="outline" label={t('cv.saveDraft')} busy={busy === 'draft'} onPress={saveDraft} />
          <Button className="flex-1" small variant="outline" label={t('cv.saveProfile')} busy={busy === 'profile'} onPress={saveToProfile} />
          <Button className="flex-1" small variant="lime" label={t('cv.download')} icon={<Download color="#041603" size={16} />} busy={busy === 'pdf'} onPress={downloadPdf} />
        </View>
      }
    >
      <Muted>{status || t('cv.saveHint')}</Muted>
      {error ? <Notice tone="bad" text={error} /> : null}
      {section(
        'contact',
        <>
          <Field label={t('cv.fullName')} value={cv.fullName} onChangeText={(v) => field('fullName', v)} autoComplete="name" />
          <Field label={t('cv.jobTitle')} value={cv.title} onChangeText={(v) => field('title', v)} />
          <Field label={t('cv.email')} value={cv.email} onChangeText={(v) => field('email', v)} keyboardType="email-address" autoCapitalize="none" />
          <Field label={t('cv.phone')} value={cv.phone} onChangeText={(v) => field('phone', v)} keyboardType="phone-pad" />
          <Field label={t('cv.location')} value={cv.location} onChangeText={(v) => field('location', v)} />
          <Field label={t('cv.website')} value={cv.website} onChangeText={(v) => field('website', v)} keyboardType="url" autoCapitalize="none" />
        </>,
      )}
      {section(
        'summary',
        <>
          <Field value={cv.summary} onChangeText={(v) => field('summary', v)} multiline placeholder={t('cv.summaryPlaceholder')} />
          <Button small variant="outline" icon={<Sparkles color={colors.accent} size={16} />} label={t(busy === 'ai' ? 'cv.writing' : cv.summary.trim() ? 'cv.rewrite' : 'cv.writeForMe')} busy={busy === 'ai'} onPress={writeSummary} />
          <Muted>{t('cv.aiNote')}</Muted>
        </>,
      )}
      {section(
        'experience',
        <>
          {cv.experience.map((job, index) => (
            <View key={job.id} className="gap-3 border-t border-ink-100 pt-3 dark:border-slate-800">
              <Text className="text-sm font-bold text-ink-700 dark:text-slate-300">{t('cv.jobNumber', { n: index + 1 })}</Text>
              <Field label={t('cv.role')} value={job.role} onChangeText={(v) => updateJob(job.id, 'role', v)} />
              <Field label={t('cv.company')} value={job.company} onChangeText={(v) => updateJob(job.id, 'company', v)} />
              <View className="flex-row gap-3">
                <View className="flex-1"><Field label={t('cv.start')} value={job.start} onChangeText={(v) => updateJob(job.id, 'start', v)} placeholder={t('cv.startPlaceholder')} /></View>
                <View className="flex-1"><Field label={t('cv.end')} value={job.end} onChangeText={(v) => updateJob(job.id, 'end', v)} placeholder={t('cv.endPlaceholder')} /></View>
              </View>
              <Field label={t('cv.whatYouDid')} value={job.description} onChangeText={(v) => updateJob(job.id, 'description', v)} multiline />
              {cv.experience.length > 1 ? <Button small variant="ghost" label={t('cv.removeJob')} onPress={() => field('experience', cv.experience.filter((item) => item.id !== job.id))} /> : null}
            </View>
          ))}
          <Button small variant="outline" label={`+ ${t('cv.addJob')}`} onPress={() => field('experience', [...cv.experience, { id: nextId(cv.experience), role: '', company: '', start: '', end: '', description: '' }])} />
        </>,
      )}
      {section(
        'education',
        <>
          {cv.education.map((school) => (
            <View key={school.id} className="gap-3 border-t border-ink-100 pt-3 dark:border-slate-800">
              <Field label={t('cv.school')} value={school.school} onChangeText={(v) => updateSchool(school.id, 'school', v)} />
              <Field label={t('cv.qualification')} value={school.qualification} onChangeText={(v) => updateSchool(school.id, 'qualification', v)} />
              <Field label={t('cv.year')} value={school.year} onChangeText={(v) => updateSchool(school.id, 'year', v)} keyboardType="number-pad" />
              {cv.education.length > 1 ? <Button small variant="ghost" label={t('cv.removeEntry')} onPress={() => field('education', cv.education.filter((item) => item.id !== school.id))} /> : null}
            </View>
          ))}
          <Button small variant="outline" label={`+ ${t('cv.addEntry')}`} onPress={() => field('education', [...cv.education, { id: nextId(cv.education), school: '', qualification: '', year: '' }])} />
        </>,
      )}
      {section(
        'skills',
        <>
          <Field label={t('cv.skillsLabel')} value={cv.skills} onChangeText={(v) => field('skills', v)} multiline />
          <Field label={t('cv.languages')} value={cv.languages} onChangeText={(v) => field('languages', v)} />
        </>,
      )}
    </Screen>
  );
}
