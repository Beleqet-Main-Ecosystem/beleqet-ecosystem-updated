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
  ShieldCheck,
  PlusCircle,
  X,
  Briefcase,
  RotateCcw,
  Bell,
  Sparkles,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { fetchGigs, type FreelanceJob } from '../../api/freelance';
import GigCard from '../../components/GigCard';
import CategoryPill from '../../components/CategoryPill';

const CATEGORIES = [
  { slug: '__all__', label: 'All Gigs' },
  { slug: 'web-development', label: 'Web Dev' },
  { slug: 'graphic-design', label: 'Design' },
  { slug: 'writing', label: 'Writing' },
  { slug: 'digital-marketing', label: 'Marketing' },
  { slug: 'video-animation', label: 'Video' },
];

const PRICING_TYPES = [
  { id: 'all', label: 'All Types' },
  { id: 'FIXED', label: 'Fixed Price' },
  { id: 'HOURLY', label: 'Hourly' },
];

const DEBOUNCE_MS = 300;

export default function FreelanceScreen() {
  const router = useRouter();
  const [gigs, setGigs] = useState<FreelanceJob[]>([]);
  const [activeCategory, setActiveCategory] = useState('__all__');
  const [activePricingType, setActivePricingType] = useState('all');
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
      else if (gigs.length === 0) setLoading(true);
      try {
        const data = await fetchGigs({
          limit: 40,
          ...(activeCategory !== '__all__' ? { category: activeCategory } : {}),
          ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
        });

        // Filter by pricing type if selected
        let filtered = data;
        if (activePricingType !== 'all') {
          filtered = data.filter((g) => {
            const pt = ((g as any).pricingType ?? (g as any).type ?? '').toUpperCase();
            return pt === activePricingType;
          });
        }

        setGigs(filtered);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeCategory, debouncedQuery, activePricingType],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilters =
    activeCategory !== '__all__' || activePricingType !== 'all' || query.trim().length > 0;

  function clearAllFilters() {
    setQuery('');
    setActiveCategory('__all__');
    setActivePricingType('all');
  }

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Header ── */}
      <View className="bg-primary px-5 pt-14 pb-5 shadow-md">
        {/* Brand Bar */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2.5">
            <View className="w-10 h-10 bg-brandGreen rounded-2xl items-center justify-center shadow-sm">
              <Text className="text-primary text-xl font-black">B</Text>
            </View>
            <View>
              <Text className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                Beleqet Freelance
              </Text>
              <Text className="text-white text-lg font-black tracking-tight leading-tight">
                Verified Projects
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className="flex-row items-center gap-1.5 bg-brandGreen px-3.5 py-2 rounded-2xl shadow-sm"
              onPress={() =>
                Toast.show({
                  type: 'info',
                  text1: 'Post a Project',
                  text2: 'Client project posting is available on the web portal at beleqet.com.',
                })
              }
              accessibilityLabel="Post a project"
            >
              <PlusCircle color="#041603" size={15} />
              <Text className="text-primary text-xs font-black">Post</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="w-10 h-10 bg-white/10 rounded-2xl items-center justify-center border border-white/10"
              onPress={() => router.push('/notifications')}
              accessibilityLabel="Notifications"
            >
              <Bell color="#d8ff3e" size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Escrow trust banner */}
        <View className="flex-row items-center bg-white/10 border border-white/10 rounded-2xl px-3.5 py-2.5 mb-3.5 gap-2.5">
          <ShieldCheck color="#d8ff3e" size={17} />
          <Text className="text-white/80 text-xs flex-1 leading-4">
            <Text className="text-brandGreen font-bold">BeleqetSafe Escrow:</Text> Client funds are
            held safely until project deliverables are approved.
          </Text>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-white/10 rounded-2xl px-4 py-3.5 border border-white/10 mb-3.5">
          <Search color="rgba(255,255,255,0.45)" size={17} style={{ marginRight: 8 }} />
          <TextInput
            className="flex-1 text-white text-sm"
            placeholder="Search skills, keywords, or client projects…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => load()}
            returnKeyType="search"
            accessibilityLabel="Search gigs"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query !== debouncedQuery && (
            <ActivityIndicator size="small" color="#d8ff3e" style={{ marginRight: 6 }} />
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
          className="-mx-5 mb-2.5"
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

        {/* Quick Pricing Type Filter Chips */}
        <View className="flex-row items-center gap-2 pt-1">
          {PRICING_TYPES.map((pt) => {
            const isSelected = activePricingType === pt.id;
            return (
              <TouchableOpacity
                key={pt.id}
                onPress={() => setActivePricingType(pt.id)}
                className={`px-3 py-1.5 rounded-full border ${
                  isSelected
                    ? 'bg-brandGreen border-brandGreen'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? 'text-primary font-bold' : 'text-white/70'
                  }`}
                >
                  {pt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Filter Status & Counter ── */}
      <View className="px-5 py-3 border-b border-slate-100 bg-white flex-row items-center justify-between">
        <Text className="text-slate-500 text-xs font-semibold">
          Showing <Text className="text-slate-900 font-bold">{gigs.length}</Text> open project{gigs.length !== 1 ? 's' : ''}
        </Text>
        {hasFilters && (
          <TouchableOpacity onPress={clearAllFilters}>
            <Text className="text-primary text-xs font-bold">Reset Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Feed ── */}
      {loading && gigs.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#041603" size="large" />
          <Text className="text-slate-500 text-sm mt-3 font-medium">Finding verified projects…</Text>
        </View>
      ) : (
        <FlatList
          data={gigs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}
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
              <View className="w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center mb-4">
                {hasFilters ? (
                  <Search color="#041603" size={28} />
                ) : (
                  <Briefcase color="#041603" size={28} />
                )}
              </View>
              <Text className="text-slate-900 text-lg font-bold text-center">
                {query.trim().length > 0
                  ? `No projects matching "${query.trim()}"`
                  : activeCategory !== '__all__'
                  ? `No ${CATEGORIES.find((c) => c.slug === activeCategory)?.label ?? ''} projects yet`
                  : 'No open freelance projects'}
              </Text>
              <Text className="text-slate-500 text-sm text-center mt-1.5 mb-6 max-w-xs leading-5">
                {hasFilters
                  ? 'Try checking for spelling errors, using broader keywords, or clearing your category filters.'
                  : 'New client gigs are posted frequently. Check back soon or pull down to refresh.'}
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
                  accessibilityLabel="Refresh listings"
                >
                  <RotateCcw color="#d8ff3e" size={14} />
                  <Text className="text-brandGreen text-sm font-bold">Refresh Feed</Text>
                </TouchableOpacity>
              )}
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
