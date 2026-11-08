import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bookmark, SlidersHorizontal } from 'lucide-react-native';
import { Screen, Field, Button, Select, Sheet, Chips } from '../../components/ui';
import { PagedList } from '../../components/paged-list';
import { GigCard } from '../../components/cards';
import { fetchGigCategories, searchGigs, type GigCategory, type GigSearch } from '../../api/freelance';
import { useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';

type Filters = Pick<GigSearch, 'category' | 'pricingType' | 'experienceLevel' | 'sort'>;
const NONE: Filters = { category: '', pricingType: '', experienceLevel: '', sort: 'newest' };
const LEVELS = ['Entry', 'Intermediate', 'Expert'];

export default function Freelance() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(NONE);
  const [sheet, setSheet] = useState(false);
  const [categories, setCategories] = useState<GigCategory[]>([]);

  useEffect(() => {
    fetchGigCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const active = [filters.category, filters.pricingType, filters.experienceLevel].filter(Boolean).length + (filters.sort && filters.sort !== 'newest' ? 1 : 0);
  const saved = user ? (
    <Pressable onPress={() => router.push('/saved-projects')} accessibilityRole="button" accessibilityLabel={t('m.savedProjects')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
      <Bookmark color="#fff" size={22} />
    </Pressable>
  ) : null;

  const header = (
    <View className="gap-3 pb-1">
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Field value={draft} onChangeText={setDraft} placeholder={t('m.searchProjects')} returnKeyType="search" onSubmitEditing={() => setQ(draft.trim())} autoCorrect={false} />
        </View>
        <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={t('m.filters')} className="min-h-12 flex-row items-center gap-1.5 rounded-lg border border-ink-300 bg-surface px-3 dark:border-slate-700 dark:bg-slate-900">
          <SlidersHorizontal color="#00653B" size={18} />
          {active > 0 ? <Text className="text-sm font-bold text-forest dark:text-limeAccent">{active}</Text> : null}
        </Pressable>
      </View>
      <Chips
        value={filters.category ?? ''}
        onChange={(category) => setFilters((current) => ({ ...current, category }))}
        options={[{ value: '', label: t('m.all') }, ...categories.map((c) => ({ value: c.slug, label: c.label }))]}
      />
    </View>
  );

  return (
    <Screen title={t('m.tabs.freelance')} back={false} right={saved} scroll={false}>
      <PagedList
        query={JSON.stringify({ q, ...filters })}
        load={(page) => searchGigs({ q, ...filters, page, limit: 20 })}
        render={(gig) => <GigCard gig={gig} />}
        keyOf={(gig) => gig.id}
        header={header}
        emptyTitle={t('m.noProjects')}
        emptyText={t('m.tryOtherFilters')}
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

function FilterForm({ initial, categories, onApply }: { initial: Filters; categories: GigCategory[]; onApply: (filters: Filters) => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  return (
    <View className="gap-4 p-4">
      <Select label={t('m.category')} value={form.category} onChange={(category) => setForm({ ...form, category })} options={[{ value: '', label: t('m.all') }, ...categories.map((c) => ({ value: c.slug, label: c.label }))]} />
      <Select
        label={t('freelance.gig.pricing')}
        value={form.pricingType}
        onChange={(pricingType) => setForm({ ...form, pricingType })}
        options={[
          { value: '', label: t('m.all') },
          { value: 'FIXED', label: t('freelance.fixed') },
          { value: 'HOURLY', label: t('freelance.hourly') },
        ]}
      />
      <Select
        label={t('freelance.gig.experience')}
        value={form.experienceLevel}
        onChange={(experienceLevel) => setForm({ ...form, experienceLevel })}
        options={[{ value: '', label: t('m.all') }, ...LEVELS.map((level) => ({ value: level, label: t(`m.level.${level}`) }))]}
      />
      <Select
        label={t('m.sort')}
        value={form.sort}
        onChange={(sort) => setForm({ ...form, sort: sort as Filters['sort'] })}
        options={[
          { value: 'newest', label: t('m.sortNewest') },
          { value: 'budget_high', label: t('m.sortBudgetHigh') },
          { value: 'budget_low', label: t('m.sortBudgetLow') },
        ]}
      />
      <View className="flex-row gap-3">
        <Button className="flex-1" variant="outline" label={t('m.clear')} onPress={() => onApply(NONE)} />
        <Button className="flex-1" label={t('m.apply')} onPress={() => onApply(form)} />
      </View>
    </View>
  );
}
