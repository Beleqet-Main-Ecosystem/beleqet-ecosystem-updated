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
import { Search, Bell, X } from 'lucide-react-native';
import { fetchJobs, fetchCategories, type NormalizedJob, type JobCategory } from '../../api/jobs';
import { useAuthStore } from '../../store/auth.store';
import JobCard from '../../components/JobCard';
import CategoryPill from '../../components/CategoryPill';

const ALL_SLUG = '__all__';
const DEBOUNCE_MS = 300;

export default function JobsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [jobs, setJobs] = useState<NormalizedJob[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState(ALL_SLUG);
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
          }),
          fetchCategories(),
        ]);
        setJobs(jobData);
        setCategories(catData);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeCategory, debouncedQuery],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const greeting =
    user?.firstName ? `Hi, ${user.firstName} 👋` : 'Find your next opportunity';

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Header ── */}
      <View className="bg-primary px-5 pt-14 pb-5">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white/50 text-xs font-semibold uppercase tracking-widest">
              Beleqet Jobs
            </Text>
            <Text className="text-white text-xl font-black mt-0.5">{greeting}</Text>
          </View>
          <TouchableOpacity
            className="w-10 h-10 bg-white/10 rounded-full items-center justify-center"
            onPress={() => router.push('/notifications')}
            accessibilityLabel="Notifications"
          >
            <Bell color="#d8ff3e" size={18} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-white/10 rounded-2xl px-4 py-3 gap-3">
          <Search color="rgba(255,255,255,0.4)" size={16} />
          <TextInput
            className="flex-1 text-white text-sm"
            placeholder="Search jobs, companies…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => load()}
            returnKeyType="search"
            accessibilityLabel="Search jobs"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query !== debouncedQuery && (
            <ActivityIndicator size="small" color="#d8ff3e" />
          )}
          {query.length > 0 && query === debouncedQuery && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Clear search"
            >
              <X color="rgba(255,255,255,0.6)" size={16} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3 -mx-5"
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
      </View>

      {/* ── Feed ── */}
      {loading && jobs.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#041603" size="large" />
          <Text className="text-muted text-sm mt-3">Finding opportunities…</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
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
            <View className="flex-1 items-center justify-center py-20 px-6">
              <View className="w-16 h-16 rounded-full bg-primary/5 items-center justify-center mb-4">
                <Search color="#64748b" size={28} />
              </View>
              <Text className="text-slate-800 text-lg font-bold text-center">No jobs found</Text>
              <Text className="text-muted text-sm text-center mt-1 mb-5">
                We couldn't find any opportunities matching your filters.
              </Text>
              {(query.length > 0 || activeCategory !== ALL_SLUG) && (
                <TouchableOpacity
                  className="bg-primary px-5 py-2.5 rounded-full"
                  onPress={() => {
                    setQuery('');
                    setActiveCategory(ALL_SLUG);
                  }}
                  accessibilityLabel="Clear all filters"
                >
                  <Text className="text-brandGreen text-sm font-bold">Clear Filters</Text>
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
