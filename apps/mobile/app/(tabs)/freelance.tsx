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
import { Search, Shield, PlusCircle } from 'lucide-react-native';
import { fetchGigs, type Gig } from '../../api/freelance';
import GigCard from '../../components/GigCard';
import CategoryPill from '../../components/CategoryPill';

const CATEGORIES = [
  { slug: '__all__', label: 'All Gigs' },
  { slug: 'web-app-dev', label: 'Web & App Dev' },
  { slug: 'design-creative', label: 'Design' },
  { slug: 'writing-translation', label: 'Writing' },
  { slug: 'marketing-seo', label: 'Marketing' },
  { slug: 'data-analytics', label: 'Data' },
  { slug: 'video-animation', label: 'Video' },
  { slug: 'finance-accounting', label: 'Finance' },
];

export default function FreelanceScreen() {
  const router = useRouter();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [activeCategory, setActiveCategory] = useState('__all__');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (opts?.refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await fetchGigs({
          limit: 40,
          ...(activeCategory !== '__all__' ? { category: activeCategory } : {}),
          ...(query.trim() ? { q: query.trim() } : {}),
        });
        setGigs(data);
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

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Header ── */}
      <View className="bg-primary px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white/50 text-xs font-semibold uppercase tracking-widest">
              Beleqet Freelance
            </Text>
            <Text className="text-white text-xl font-black mt-0.5">
              Open Projects
            </Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center gap-1.5 bg-brandGreen px-3 py-2 rounded-full"
            onPress={() => router.push('/post-gig')}
            accessibilityLabel="Post a project"
          >
            <PlusCircle color="#041603" size={14} />
            <Text className="text-primary text-xs font-black">Post</Text>
          </TouchableOpacity>
        </View>

        {/* Escrow trust banner */}
        <View className="flex-row items-center bg-white/10 rounded-xl px-3 py-2.5 mb-3 gap-2">
          <Shield color="#d8ff3e" size={14} />
          <Text className="text-white/70 text-xs flex-1">
            <Text className="text-brandGreen font-bold">BeleqetSafe Escrow</Text>
            {' '}— funds held until work is approved
          </Text>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-white/10 rounded-2xl px-4 py-3 gap-3 mb-3">
          <Search color="rgba(255,255,255,0.4)" size={16} />
          <TextInput
            className="flex-1 text-white text-sm"
            placeholder="Search skills or project type…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => load()}
            returnKeyType="search"
            accessibilityLabel="Search gigs"
          />
        </View>

        {/* Category pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {CATEGORIES.map((c) => (
            <CategoryPill
              key={c.slug}
              label={c.label}
              active={activeCategory === c.slug}
              onPress={() => setActiveCategory(c.slug)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Gig count ── */}
      <View className="px-4 py-3 border-b border-black/5">
        <Text className="text-muted text-xs font-semibold">
          {gigs.length} project{gigs.length !== 1 ? 's' : ''} available
        </Text>
      </View>

      {/* ── Feed ── */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#041603" size="large" />
        </View>
      ) : (
        <FlatList
          data={gigs}
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
              <Text className="text-muted text-base">No gigs found</Text>
              <Text className="text-muted/60 text-sm mt-1">Try a different category</Text>
            </View>
          }
          renderItem={({ item }) => (
            <GigCard gig={item} onPress={() => router.push(`/gig/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}
