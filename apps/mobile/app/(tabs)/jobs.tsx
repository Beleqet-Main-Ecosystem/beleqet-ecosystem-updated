import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  Bell,
  X,
  Briefcase,
  RotateCcw,
  Sparkles,
} from 'lucide-react-native';
import { fetchJobs, fetchCategories, type NormalizedJob, type JobCategory } from '../../api/jobs';
import { useAuthStore } from '../../store/auth.store';
import JobCard from '../../components/JobCard';
import CategoryPill from '../../components/CategoryPill';

const ALL_SLUG = '__all__';
const DEBOUNCE_MS = 300;

// Curated quick filter types
const WORK_TYPES = [
  { id: 'all', label: 'All Types' },
  { id: 'FULL_TIME', label: 'Full Time' },
  { id: 'REMOTE', label: 'Remote' },
  { id: 'HYBRID', label: 'Hybrid' },
  { id: 'CONTRACT', label: 'Contract' },
];

export default function JobsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [jobs, setJobs] = useState<NormalizedJob[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState(ALL_SLUG);
  const [activeWorkType, setActiveWorkType] = useState('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (opts?.refresh) setRefreshing(true);
      else if (jobs.length === 0) setLoading(true);
      try {
        const [jobData, catData] = await Promise.all([
          fetchJobs({
            limit: 40,
            ...(activeCategory !== ALL_SLUG ? { category: activeCategory } : {}),
            ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
            ...(activeWorkType !== 'all' ? { type: activeWorkType as any } : {}),
          }),
          fetchCategories(),
        ]);

        // Filter by work type if selected
        let filtered = jobData;
        if (activeWorkType !== 'all') {
          filtered = jobData.filter((j) => {
            const t = (j.type ?? '').toUpperCase();
            return t === activeWorkType || (j.typeDisplay ?? '').toUpperCase().includes(activeWorkType);
          });
        }

        setJobs(filtered);
        setCategories(catData);
      } catch {
        // preserve existing jobs on error
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeCategory, debouncedQuery, activeWorkType, jobs.length],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const greeting = user?.firstName
    ? `Welcome back, ${user.firstName}`
    : 'Find your next career';

  const hasFilters = activeCategory !== ALL_SLUG || activeWorkType !== 'all' || query.trim().length > 0;

  function clearAllFilters() {
    setQuery('');
    setActiveCategory(ALL_SLUG);
    setActiveWorkType('all');
  }

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Top Header ── */}
      <View className="bg-primary px-5 pt-14 pb-5 shadow-md">
        
        {/* Brand Bar */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2.5">
            <View className="w-10 h-10 bg-brandGreen rounded-2xl items-center justify-center shadow-sm">
              <Text className="text-primary text-xl font-black">B</Text>
            </View>
            <View>
              <Text className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                Beleqet Jobs
              </Text>
              <Text className="text-white text-lg font-black tracking-tight leading-tight">
                {greeting}
              </Text>
            </View>
          </View>

          {/* Notifications Bell */}
          <TouchableOpacity
            className="w-10 h-10 bg-white/10 rounded-2xl items-center justify-center border border-white/10 active:opacity-75"
            onPress={() => router.push('/notifications')}
            accessibilityLabel="Notifications"
          >
            <Bell color="#d8ff3e" size={18} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-white/10 rounded-2xl px-4 py-3.5 border border-white/10">
          <Search color="rgba(255,255,255,0.45)" size={17} style={{ marginRight: 8 }} />
          <TextInput
            className="flex-1 text-white text-sm"
            placeholder="Search job titles, skills, or companies…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => load()}
            returnKeyType="search"
            accessibilityLabel="Search jobs"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query !== debouncedQuery && (
            <ActivityIndicator size="small" color="#d8ff3e" style={{ marginRight: 6 }} />
          )}
          {query.length > 0 && query === debouncedQuery && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Clear search"
            >
              <X color="rgba(255,255,255,0.6)" size={16} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3.5 -mx-5"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          <CategoryPill
            label="All Jobs"
            active={activeCategory === ALL_SLUG}
            onPress={() => setActiveCategory(ALL_SLUG)}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c.slug}
              label={c.label}
              active={activeCategory === c.slug}
              onPress={() => setActiveCategory(c.slug)}
            />
          ))}
        </ScrollView>

        {/* Work Type Quick Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2.5 -mx-5"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}
        >
          {WORK_TYPES.map((wt) => {
            const isSelected = activeWorkType === wt.id;
            return (
              <TouchableOpacity
                key={wt.id}
                onPress={() => setActiveWorkType(wt.id)}
                activeOpacity={0.7}
                className={`px-3 py-1.5 rounded-xl border ${
                  isSelected
                    ? 'bg-white/20 border-brandGreen'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    isSelected ? 'text-brandGreen' : 'text-white/60'
                  }`}
                >
                  {wt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Active Filters & Result Count Bar ── */}
      <View className="px-5 py-3 bg-white border-b border-black/5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Sparkles color="#041603" size={13} />
          <Text className="text-slate-800 text-xs font-bold">
            {jobs.length} {jobs.length === 1 ? 'Opportunity' : 'Opportunities'} Available
          </Text>
        </View>

        {hasFilters && (
          <TouchableOpacity
            onPress={clearAllFilters}
            className="flex-row items-center gap-1"
          >
            <RotateCcw color="#041603" size={12} />
            <Text className="text-primary text-xs font-black">Reset Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Feed Content ── */}
      {loading && jobs.length === 0 ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#041603" size="large" />
          <Text className="text-muted text-sm font-semibold mt-3">
            Finding verified opportunities…
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ refresh: true })}
              tintColor="#041603"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16 px-6">
              <View className="w-16 h-16 rounded-3xl bg-primary/10 items-center justify-center mb-4">
                {query.length > 0 || activeCategory !== ALL_SLUG ? (
                  <Search color="#041603" size={28} />
                ) : (
                  <Briefcase color="#041603" size={28} />
                )}
              </View>

              <Text className="text-slate-900 text-lg font-bold text-center">
                {query.trim().length > 0
                  ? `No jobs matching "${query.trim()}"`
                  : activeCategory !== ALL_SLUG
                  ? `No ${categories.find((c) => c.slug === activeCategory)?.label ?? ''} jobs found`
                  : activeWorkType !== 'all'
                  ? `No ${WORK_TYPES.find((w) => w.id === activeWorkType)?.label ?? ''} jobs right now`
                  : 'No open jobs available'}
              </Text>

              <Text className="text-muted text-sm text-center mt-1.5 mb-6 max-w-xs leading-5">
                {hasFilters
                  ? 'Try checking for typos, using broader keywords, or clearing your active filters.'
                  : 'Verified companies post vacancies regularly. Pull down to check for newly published roles.'}
              </Text>

              {hasFilters ? (
                <TouchableOpacity
                  className="flex-row items-center gap-2 bg-primary px-5 py-3 rounded-full shadow-sm"
                  onPress={clearAllFilters}
                  accessibilityLabel="Clear all filters"
                >
                  <RotateCcw color="#d8ff3e" size={14} />
                  <Text className="text-brandGreen text-sm font-bold">Clear All Filters</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="flex-row items-center gap-2 bg-primary px-5 py-3 rounded-full shadow-sm"
                  onPress={() => load({ refresh: true })}
                  accessibilityLabel="Refresh jobs"
                >
                  <RotateCcw color="#d8ff3e" size={14} />
                  <Text className="text-brandGreen text-sm font-bold">Refresh Listings</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}
