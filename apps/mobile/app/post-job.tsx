import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, X } from 'lucide-react-native';
import { Screen, Card, H1, H2, Muted, Field, Select, Chips, Button, Notice, Toggle, DateField, Failed, Loading, Progress } from '../components/ui';
import { createCompany, createJob, fetchCompany, fetchMyJobs, fetchQuota, updateJob, type Company, type EmployerJob } from '../api/employer';
import { fetchJobCategories, JOB_TYPES, type Category } from '../api/jobs';
import { isEmployer, useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { safeHttpUrl } from '../lib/format';

const PAY_PERIODS = ['monthly', 'daily', 'hourly'] as const;
const LEVELS = ['Entry level', 'Junior', 'Mid-level', 'Senior'] as const;
const MIN_DESCRIPTION = 50;

/** Post a job, or edit one (?edit=id). Same fields and rules as the website's PostJob. */
export default function PostJob() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const editing = Boolean(edit);
  const load = useLoad(
    () =>
      Promise.all([
        fetchCompany(),
        fetchJobCategories(),
        fetchQuota().catch(() => null),
        edit ? fetchMyJobs().then((jobs) => jobs.find((job) => job.id === edit) ?? null) : Promise.resolve(null),
      ]),
    [edit],
    { enabled: isEmployer(user) },
  );
  const [company, setCompany] = useState<Company | null | undefined>(undefined);

  useEffect(() => {
    if (load.data) setCompany(load.data[0]);
  }, [load.data]);

  const title = editing ? t('postJob.editTitle') : t('postJob.title');
  if (!user || !isEmployer(user)) {
    return (
      <Screen title={title}>
        <Card>
          <H2>{t(user ? 'postJob.roleTitle' : 'postJob.gateTitle')}</H2>
          <Muted>{t(user ? 'postJob.roleText' : 'postJob.gateText')}</Muted>
          <Button
            label={t(user ? 'postJob.createEmployer' : 'postJob.signIn')}
            onPress={() => (user ? router.push({ pathname: '/(auth)/register', params: { role: 'EMPLOYER' } }) : router.push({ pathname: '/(auth)/login', params: { next: '/post-job' } }))}
          />
        </Card>
      </Screen>
    );
  }
  if (load.loading || (load.data && company === undefined)) return <Screen title={title}><Loading /></Screen>;
  if (load.error || !load.data) return <Screen title={title}><Failed message={t('postJob.companyFailed')} onRetry={load.reload} /></Screen>;
  if (company === null) return <CompanySetup onCreated={setCompany} />;
  const [, categories, quota, saved] = load.data;
  if (editing && !saved) {
    return (
      <Screen title={title}>
        <Card>
          <H2>{t('postJob.editMissing')}</H2>
          <Muted>{t('postJob.editMissingText')}</Muted>
          <Button label={t('postJob.dashboard')} onPress={() => router.replace('/(tabs)/hiring')} />
        </Card>
      </Screen>
    );
  }
  return <JobForm categories={categories} quota={quota} saved={saved} editId={edit} />;
}

function JobForm({ categories, quota, saved, editId }: { categories: Category[]; quota: { plan: string; used: number; max: number | null; canFeature: boolean } | null; saved: EmployerJob | null; editId?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const editing = Boolean(editId);
  const [title, setTitle] = useState(saved?.title ?? '');
  const [categoryId, setCategoryId] = useState(saved?.categoryId ?? '');
  const [location, setLocation] = useState(saved?.location ?? '');
  const [vacancies, setVacancies] = useState(String(saved?.vacancies ?? 1));
  const [type, setType] = useState(saved?.type ?? 'FULL_TIME');
  const [salaryMin, setSalaryMin] = useState(saved?.salaryMin ? String(saved.salaryMin) : '');
  const [salaryMax, setSalaryMax] = useState(saved?.salaryMax ? String(saved.salaryMax) : '');
  const [salaryType, setSalaryType] = useState<string>(PAY_PERIODS.find((p) => p === saved?.salaryType?.toLowerCase()) ?? 'monthly');
  const [description, setDescription] = useState(saved?.description ?? '');
  const [requirements, setRequirements] = useState(saved?.requirements ?? '');
  const [experienceLevel, setExperienceLevel] = useState(saved?.experienceLevel ?? '');
  const [years, setYears] = useState(saved?.yearsOfExperience ?? '');
  const [qualification, setQualification] = useState(saved?.qualification ?? '');
  const [tags, setTags] = useState<string[]>(saved?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [deadline, setDeadline] = useState(saved?.deadline ? saved.deadline.slice(0, 10) : '');
  const [featured, setFeatured] = useState(Boolean(saved?.featured));
  const [urgent, setUrgent] = useState(Boolean(saved?.urgent));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState('');

  const min = Number(salaryMin);
  const max = Number(salaryMax);
  const atLimit = !editing && quota?.max != null && quota.used >= quota.max;
  const canFeature = Boolean(quota?.canFeature || saved?.featured);

  if (doneId) {
    return (
      <Screen title={editing ? t('postJob.editTitle') : t('postJob.title')}>
        <Card>
          <CheckCircle2 color={colors.accent} size={32} />
          <H1>{t(editing ? 'postJob.savedTitle' : 'postJob.liveTitle')}</H1>
          <Muted>{t(editing ? 'postJob.savedText' : 'postJob.liveText', { title: title.trim() })}</Muted>
          <Button label={t('postJob.view')} onPress={() => router.replace(`/job/${doneId}`)} />
          <Button label={t('postJob.dashboard')} variant="outline" onPress={() => router.replace('/(tabs)/hiring')} />
        </Card>
      </Screen>
    );
  }

  function addTag() {
    const tag = tagDraft.trim().replace(/,$/, '');
    if (tag && !tags.some((item) => item.toLowerCase() === tag.toLowerCase())) setTags([...tags, tag]);
    setTagDraft('');
  }

  function problem(): string {
    if (title.trim().length < 3) return t('postJob.errTitle');
    if (!categoryId) return t('postJob.errCategory');
    if (!location.trim()) return t('postJob.errLocation');
    if (min && max && max < min) return t('postJob.errSalary');
    if (description.trim().length < MIN_DESCRIPTION) return t('postJob.errDescription');
    return '';
  }

  async function publish() {
    const issue = problem();
    setError(issue);
    if (issue) return;
    setBusy(true);
    // An edit sends null so a field the employer emptied is cleared, not left as it was.
    const empty = editing ? null : undefined;
    const body = {
      title: title.trim(),
      description: description.trim(),
      requirements: requirements.trim() || empty,
      location: location.trim(),
      type,
      categoryId,
      salaryMin: min || empty,
      salaryMax: max || empty,
      salaryType,
      vacancies: Number(vacancies) || 1,
      experienceLevel: experienceLevel || empty,
      yearsOfExperience: years.trim() || empty,
      qualification: qualification.trim() || empty,
      tags,
      deadline: deadline || empty,
      applyType: empty,
      applyUrl: empty,
      applyEmail: empty,
      featured: canFeature ? featured : undefined,
      urgent,
    };
    try {
      const job = editing ? await updateJob(editId!, body) : await createJob(body);
      setDoneId(job.id ?? editId ?? '');
    } catch (failure) {
      setError(errorText(failure, t, editing ? 'postJob.saveFailed' : 'postJob.publishFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={editing ? t('postJob.editTitle') : t('postJob.title')}
      footer={<Button label={editing ? t('postJob.save') : t('postJob.publish')} onPress={publish} busy={busy} disabled={atLimit} />}
    >
      {quota && quota.max != null && !editing ? (
        <Card>
          <View className="flex-row justify-between">
            <Text className="font-bold text-ink-900 dark:text-white">{t('postJob.planName', { plan: quota.plan })}</Text>
            <Muted>{t('postJob.postsUsed', { used: quota.used, max: quota.max })}</Muted>
          </View>
          <Progress value={(quota.used / Math.max(1, quota.max)) * 100} />
          {atLimit ? (
            <>
              <Notice tone="warn" text={t('postJob.limitReached')} />
              <Button small label={t('m.plan.upgrade')} onPress={() => router.push('/plan')} />
            </>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <H2>{t('postJob.basics')}</H2>
        <Field label={t('postJob.jobTitle')} value={title} onChangeText={setTitle} />
        <Select label={t('postJob.category')} value={categoryId} onChange={setCategoryId} placeholder={t('postJob.chooseCategory')} options={categories.map((c) => ({ value: c.id, label: c.label }))} />
        <Field label={t('postJob.location')} value={location} onChangeText={setLocation} placeholder="Addis Ababa" />
        <Field label={t('postJob.openings')} value={vacancies} onChangeText={(value) => setVacancies(value.replace(/\D/g, ''))} keyboardType="number-pad" />
        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('postJob.jobType')}</Text>
          <Chips value={type} onChange={setType} options={JOB_TYPES.map((value) => ({ value, label: t(`search.types.${value}`) }))} />
        </View>
      </Card>

      <Card>
        <H2>{t('postJob.salary')}</H2>
        <Muted>{t('postJob.salaryHint')}</Muted>
        <View className="flex-row gap-3">
          <View className="flex-1"><Field label={t('m.min')} value={salaryMin} onChangeText={(value) => setSalaryMin(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
          <View className="flex-1"><Field label={t('m.max')} value={salaryMax} onChangeText={(value) => setSalaryMax(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('postJob.paid')}</Text>
          <Chips value={salaryType} onChange={setSalaryType} options={PAY_PERIODS.map((value) => ({ value, label: t(`postJob.periods.${value}`) }))} />
        </View>
      </Card>

      <Card>
        <H2>{t('postJob.descriptionTitle')}</H2>
        <Field label={t('postJob.about')} value={description} onChangeText={setDescription} multiline hint={`${description.trim().length}/${MIN_DESCRIPTION}+`} />
        <Field label={t('postJob.requirements')} value={requirements} onChangeText={setRequirements} multiline />
        <Select label={t('postJob.experience')} value={experienceLevel} onChange={setExperienceLevel} options={[{ value: '', label: t('postJob.notSpecified') }, ...LEVELS.map((level) => ({ value: level, label: t(`postJob.levels.${level}`) }))]} />
        <Field label={t('postJob.years')} value={years} onChangeText={setYears} />
        <Field label={t('postJob.qualification')} value={qualification} onChangeText={setQualification} />
        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('postJob.skills')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {tags.map((tag) => (
              <Pressable key={tag} onPress={() => setTags(tags.filter((item) => item !== tag))} accessibilityRole="button" className="flex-row items-center gap-1 rounded-full bg-ink-100 px-3 py-1.5 dark:bg-slate-800">
                <Text className="text-[13px] font-semibold text-ink-800 dark:text-slate-100">{tag}</Text>
                <X color={colors.muted} size={14} />
              </Pressable>
            ))}
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1"><Field value={tagDraft} onChangeText={setTagDraft} onSubmitEditing={addTag} returnKeyType="done" /></View>
            <Button label={t('dash.add')} variant="outline" onPress={addTag} />
          </View>
        </View>
      </Card>

      <Card>
        <H2>{t('postJob.applyTitle')}</H2>
        <Text className="font-bold text-ink-900 dark:text-white">{t('postJob.methods.internal.label')}</Text>
        <Muted>{t('postJob.methods.internal.text')}</Muted>
        <DateField label={t('postJob.deadline')} value={deadline} onChange={setDeadline} minimumDate={new Date()} />
      </Card>

      <Card>
        <H2>{t('postJob.visibility')}</H2>
        <Toggle label={t('postJob.feature')} hint={t(canFeature ? 'postJob.featureText' : 'postJob.featureLocked')} value={featured} onChange={setFeatured} disabled={!canFeature} />
        <Toggle label={t('postJob.urgent')} hint={t('postJob.urgentText')} value={urgent} onChange={setUrgent} />
      </Card>
      {error ? <Notice tone="bad" text={error} /> : null}
      <Muted>{t('postJob.editNote')}</Muted>
    </Screen>
  );
}

/** Every job belongs to a company; the first post asks for it. Same fields as the website. */
function CompanySetup({ onCreated }: { onCreated: (company: Company) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', industry: '', location: '', website: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    if (!form.name.trim() || !form.industry.trim() || !form.location.trim() || !form.description.trim()) return setError(t('auth.required'));
    if (form.website.trim() && !safeHttpUrl(form.website)) return setError(t('postJob.errUrl'));
    setBusy(true);
    try {
      onCreated(await createCompany({ ...form, website: form.website.trim() ? safeHttpUrl(form.website)! : undefined }));
    } catch (failure) {
      setError(errorText(failure, t, 'postJob.companySaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('postJob.title')} footer={<Button label={busy ? t('postJob.saving') : t('postJob.companySave')} onPress={save} busy={busy} />}>
      <H2>{t('postJob.companyTitle')}</H2>
      <Muted>{t('postJob.companyText')}</Muted>
      <Card>
        {(['name', 'industry', 'location', 'website'] as const).map((field) => (
          <Field key={field} label={t(`postJob.company.${field}`)} value={form[field]} onChangeText={(value) => setForm({ ...form, [field]: value })} autoCapitalize={field === 'website' ? 'none' : 'sentences'} keyboardType={field === 'website' ? 'url' : 'default'} />
        ))}
        <Field label={t('postJob.company.description')} value={form.description} onChangeText={(description) => setForm({ ...form, description })} multiline />
      </Card>
      {error ? <Notice tone="bad" text={error} /> : null}
    </Screen>
  );
}
