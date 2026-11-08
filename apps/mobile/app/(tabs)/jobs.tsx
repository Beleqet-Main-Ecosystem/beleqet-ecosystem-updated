import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SlidersHorizontal } from 'lucide-react-native';
import { Screen, Field, Button, Select, Sheet, Chips, Muted } from '../../components/ui';
import { PagedList } from '../../components/paged-list';
import { JobCard } from '../../components/cards';
import { EXPERIENCE_LEVELS, fetchJobCategories, JOB_TYPES, POSTED_WITHIN, SALARY_STEPS, searchJobs, type Category } from '../../api/jobs';
import { useTranslation } from '../../lib/i18n';

type Filters = { location: string; category: string; types: string[]; salaryMin: number; experienceLevel: string; postedWithin: number; sort: 'newest' | 'salary' };
const NONE: Filters = { location: '', category: '', types: [], salaryMin: 0, experienceLevel: '', postedWithin: 0, sort: 'newest' };

export default function Jobs() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const [draft, setDraft] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const [filters, setFilters] = useState<Filters>({ ...NONE, category: params.category ?? '' });
  const [sheet, setSheet] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchJobCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // A new ?q= (from the home search) replaces the search.
  const [seenQ, setSeenQ] = useState(params.q);
  if (params.q !== seenQ) {
    setSeenQ(params.q);
    setDraft(params.q ?? '');
    setQ(params.q ?? '');
  }

  const active =
    Number(Boolean(filters.location)) + Number(Boolean(filters.category)) + filters.types.length +
    Number(Boolean(filters.salaryMin)) + Number(Boolean(filters.experienceLevel)) + Number(Boolean(filters.postedWithin)) + Number(filters.sort === 'salary');
  const query = JSON.stringify({ q, ...filters });

  const header = (
    <View className="gap-3 pb-1">
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field value={draft} onChangeText={setDraft} placeholder={t('m.searchJobs')} returnKeyType="search" onSubmitEditing={() => setQ(draft.trim())} autoCorrect={false} />
        </View>
        <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={t('m.filters')} className="min-h-12 flex-row items-center gap-1.5 rounded-lg border border-ink-300 bg-surface px-3 dark:border-slate-700 dark:bg-slate-900">
          <SlidersHorizontal color="#00653B" size={18} />
          {active > 0 ? <Text className="text-sm font-bold text-forest dark:text-limeAccent">{active}</Text> : null}
        </Pressable>
      </View>
      <Chips
        value={filters.types[0] ?? ''}
        onChange={(value) => setFilters((current) => ({ ...current, types: value ? [value] : [] }))}
        options={[{ value: '', label: t('m.all') }, ...JOB_TYPES.map((type) => ({ value: type, label: t(`search.types.${type}`) }))]}
      />
    </View>
  );

  return (
    <Screen title={t('m.tabs.jobs')} back={false} scroll={false}>
      <PagedList
        query={query}
        load={(page) => searchJobs({ q, ...filters, page, limit: 20 })}
        render={(job) => <JobCard job={job} />}
        keyOf={(job) => job.id}
        header={header}
        emptyTitle={t('search.emptyTitle')}
        emptyText={t('search.emptyText')}
      />
      <Sheet visible={sheet} title={t('m.filters')} onClose={() => setSheet(false)}>
        <FilterForm
          initial={filters}
          categories={categories}
          onApply={(next) => {
            setFilters(next);
            setSheet(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

function FilterForm({ initial, categories, onApply }: { initial: Filters; categories: Category[]; onApply: (filters: Filters) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const toggle = (type: string) =>
    setForm((current) => ({ ...current, types: current.types.includes(type) ? current.types.filter((x) => x !== type) : [...current.types, type] }));
  return (
    <View className="gap-4 p-4">
      <Field label={t('m.location')} value={form.location} onChangeText={(location) => setForm({ ...form, location })} placeholder="Addis Ababa" />
      <Select
        label={t('m.category')}
        value={form.category}
        onChange={(category) => setForm({ ...form, category })}
        options={[{ value: '', label: t('m.all') }, ...categories.map((c) => ({ value: c.slug, label: c.label }))]}
      />
      <View className="gap-2">
        <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('m.jobTypeLabel')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {JOB_TYPES.map((type) => {
            const on = form.types.includes(type);
            return (
              <Pressable key={type} onPress={() => toggle(type)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} className={`min-h-9 justify-center rounded-full border px-3.5 ${on ? 'border-obsidian bg-obsidian dark:border-limeAccent dark:bg-limeAccent' : 'border-ink-300 dark:border-slate-700'}`}>
                <Text className={`text-[13px] font-bold ${on ? 'text-white dark:text-obsidian' : 'text-ink-700 dark:text-slate-200'}`}>{t(`search.types.${type}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Select
        label={t('search.salaryMin')}
        value={String(form.salaryMin)}
        onChange={(value) => setForm({ ...form, salaryMin: Number(value) })}
        options={[{ value: '0', label: t('search.any') }, ...SALARY_STEPS.map((amount) => ({ value: String(amount), label: t('search.salaryFrom', { amount: amount.toLocaleString('en-US') }) }))]}
      />
      <Select
        label={t('search.experience')}
        value={form.experienceLevel}
        onChange={(experienceLevel) => setForm({ ...form, experienceLevel })}
        options={[{ value: '', label: t('search.any') }, ...EXPERIENCE_LEVELS.map((level) => ({ value: level, label: t(`postJob.levels.${level}`) }))]}
      />
      <Select
        label={t('search.posted')}
        value={String(form.postedWithin)}
        onChange={(value) => setForm({ ...form, postedWithin: Number(value) })}
        options={[{ value: '0', label: t('search.anyTime') }, ...POSTED_WITHIN.map((days) => ({ value: String(days), label: t(`search.postedWithin.${days}`) }))]}
      />
      <Select
        label={t('search.sortBy')}
        value={form.sort}
        onChange={(sort) => setForm({ ...form, sort: sort as Filters['sort'] })}
        options={[{ value: 'newest', label: t('search.order') }, { value: 'salary', label: t('search.sortSalary') }]}
      />
      <Muted>{t('m.filtersHint')}</Muted>
      <View className="flex-row gap-3">
        <Button className="flex-1" variant="outline" label={t('m.clear')} onPress={() => onApply(NONE)} />
        <Button className="flex-1" label={t('m.apply')} onPress={() => onApply(form)} />
      </View>
    </View>
  );
}
