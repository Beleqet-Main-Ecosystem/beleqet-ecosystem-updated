import { useEffect, useState, useCallback } from 'react';
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
import { Search, Bell } from 'lucide-react-native';
import { fetchJobs, fetchCategories, type NormalizedJob, type Category } from '../../api/jobs';
import { useAuthStore } from '../../store/auth.store';
import JobCard from '../../components/JobCard';
import CategoryPill from '../../components/CategoryPill';

const ALL_SLUG = '__all__';

export default function JobsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [jobs, setJobs] = useState<NormalizedJob[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState(ALL_SLUG);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (opts?.refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [jobData, catData] = await Promise.all([
          fetchJobs({
            limit: 40,
            ...(activeCategory !== ALL_SLUG ? { category: activeCategory } : {}),
            ...(query.trim() ? { q: query.trim() } : {}),
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
    [activeCategory, query],
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
          />
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
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#041603" size="large" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ refresh: true })}
              tintColor="#041603"
            />
          }
          ListEmptyComponent={
            <View className="items-center py-20">
              <Text className="text-muted text-base">No jobs found</Text>
              <Text className="text-muted/60 text-sm mt-1">Try a different category or search term</Text>
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
