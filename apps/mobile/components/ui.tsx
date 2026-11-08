import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { useTranslation } from '../lib/i18n';
import { initials } from '../lib/format';

// ── Layout ─────────────────────────────────────────────────────────────────────

type ScreenProps = {
  title?: string;
  /** Show a back arrow (default: true when there is somewhere to go back to). */
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  /** false for screens that bring their own list (FlatList). */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Content pinned under the scroll area, e.g. a submit bar. */
  footer?: ReactNode;
};

/** A page: dark header with title and back arrow, then the content on the canvas colour. */
export function Screen({ title, back, right, children, scroll = true, refreshing, onRefresh, footer }: ScreenProps) {
  const { colors } = useTheme();
  const canGoBack = back ?? router.canGoBack();
  const body = scroll ? (
    <ScrollView
      contentContainerClassName="gap-3.5 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1">{children}</View>
  );
  return (
    <View className="flex-1 bg-canvas dark:bg-slate-950">
      <SafeAreaView edges={['top']} className="bg-obsidian">
        {title !== undefined && (
          <View className="min-h-14 flex-row items-center gap-2 px-2">
            {canGoBack ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
                <ChevronLeft color="#fff" size={24} />
              </Pressable>
            ) : (
              <View className="w-2" />
            )}
            <Text numberOfLines={1} className="flex-1 text-lg font-bold text-white">
              {title}
            </Text>
            {right}
          </View>
        )}
      </SafeAreaView>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer ? <Footer>{footer}</Footer> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** The scrolling content area of a screen, with pull-to-refresh. For screens that switch bodies. */
export function Scroll({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      contentContainerClassName="gap-3.5 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

/** A bar pinned to the bottom of the screen, above the system navigation. */
export function Footer({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} className="gap-2 border-t border-ink-200 bg-surface px-4 pt-3 dark:border-slate-800 dark:bg-slate-900">
      {children}
    </View>
  );
}

export function Card({ children, className = '', onPress }: { children: ReactNode; className?: string; onPress?: () => void }) {
  const base = `gap-2.5 rounded-xl border border-ink-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`;
  if (!onPress) return <View className={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={`${base} active:opacity-80`}>
      {children}
    </Pressable>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text className="text-2xl font-extrabold text-ink-900 dark:text-white">{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text className="text-lg font-bold text-ink-900 dark:text-white">{children}</Text>;
}

export function Body({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Text className={`text-[15px] leading-6 text-ink-700 dark:text-slate-300 ${className}`}>{children}</Text>;
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Text className={`text-[13px] leading-5 text-ink-500 dark:text-slate-400 ${className}`}>{children}</Text>;
}

/** A labelled value, for summaries ("Budget · ETB 1,000"). */
export function Fact({ label, value, tone = '' }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Muted>{label}</Muted>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text className={`shrink text-right text-sm font-bold text-ink-900 dark:text-white ${tone}`}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

/** A tappable row in a menu list. */
export function MenuRow({ icon, label, detail, onPress, danger }: { icon?: ReactNode; label: string; detail?: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="min-h-14 flex-row items-center gap-3 px-4 active:bg-ink-100 dark:active:bg-slate-800">
      {icon}
      <Text className={`flex-1 text-[15px] font-semibold ${danger ? 'text-red-700 dark:text-red-300' : 'text-ink-900 dark:text-white'}`}>{label}</Text>
      {detail ? <Muted>{detail}</Muted> : null}
      <ChevronRight color={colors.muted} size={18} />
    </Pressable>
  );
}

export function Divider() {
  return <View className="h-px bg-ink-200 dark:bg-slate-800" />;
}

// ── Actions ────────────────────────────────────────────────────────────────────

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'solid' | 'outline' | 'ghost' | 'danger' | 'lime';
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  small?: boolean;
};

export function Button({ label, onPress, variant = 'solid', busy, disabled, icon, className = '', small }: ButtonProps) {
  const { colors } = useTheme();
  const styles = {
    solid: 'bg-obsidian dark:bg-limeAccent',
    lime: 'bg-limeAccent',
    outline: 'border border-ink-300 bg-surface dark:border-slate-700 dark:bg-slate-900',
    ghost: '',
    danger: 'border border-red-300 bg-surface dark:border-red-900 dark:bg-slate-900',
  }[variant];
  const text = {
    solid: 'text-white dark:text-obsidian',
    lime: 'text-obsidian',
    outline: 'text-ink-900 dark:text-white',
    ghost: 'text-forest dark:text-limeAccent',
    danger: 'text-red-700 dark:text-red-300',
  }[variant];
  const spinner = variant === 'solid' ? colors.onAccent : colors.text;
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(busy) }}
      disabled={off}
      onPress={onPress}
      className={`${small ? 'min-h-10 px-3' : 'min-h-12 px-4'} flex-row items-center justify-center gap-2 rounded-lg ${styles} ${off ? 'opacity-60' : 'active:opacity-80'} ${className}`}
    >
      {busy ? <ActivityIndicator color={variant === 'solid' ? undefined : spinner} /> : icon}
      <Text className={`${small ? 'text-[13px]' : 'text-[15px]'} font-bold ${text}`}>{label}</Text>
    </Pressable>
  );
}

// ── Inputs ─────────────────────────────────────────────────────────────────────

type FieldProps = TextInputProps & { label?: string; hint?: string; error?: string; multiline?: boolean };

export function Field({ label, hint, error, multiline, className = '', ...input }: FieldProps) {
  const { colors } = useTheme();
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-semibold text-ink-900 dark:text-white">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        className={`${multiline ? 'min-h-28 py-3' : 'min-h-12'} rounded-lg border px-3.5 text-base text-ink-900 dark:text-white ${error ? 'border-red-500' : 'border-ink-300 dark:border-slate-700'} bg-surface dark:bg-slate-950 ${className}`}
        {...input}
      />
      {error ? <Text className="text-[13px] font-semibold text-red-700 dark:text-red-300">{error}</Text> : hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

export type Option = { value: string; label: string };

/** A field that opens a list to pick one value from. */
export function Select({ label, value, options, onChange, placeholder, error }: { label?: string; value: string | null | undefined; options: Option[]; onChange: (value: string) => void; placeholder?: string; error?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-semibold text-ink-900 dark:text-white">{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        className={`min-h-12 flex-row items-center justify-between rounded-lg border bg-surface px-3.5 dark:bg-slate-950 ${error ? 'border-red-500' : 'border-ink-300 dark:border-slate-700'}`}
      >
        <Text className={`flex-1 text-base ${current ? 'text-ink-900 dark:text-white' : 'text-ink-400'}`} numberOfLines={1}>
          {current?.label ?? placeholder ?? t('m.choose')}
        </Text>
        <ChevronDown color={colors.muted} size={18} />
      </Pressable>
      {error ? <Text className="text-[13px] font-semibold text-red-700 dark:text-red-300">{error}</Text> : null}
      <Sheet visible={open} title={label ?? placeholder ?? ''} onClose={() => setOpen(false)}>
        <FlatList
          data={options}
          keyExtractor={(option) => option.value}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onChange(item.value);
                setOpen(false);
              }}
              className="min-h-12 flex-row items-center gap-3 px-4 active:bg-ink-100 dark:active:bg-slate-800"
            >
              <Text className="flex-1 text-base text-ink-900 dark:text-white">{item.label}</Text>
              {item.value === value ? <Check color={colors.accent} size={18} /> : null}
            </Pressable>
          )}
        />
      </Sheet>
    </View>
  );
}

/** A bottom sheet with a title and a close button. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityLabel="Close" />
      <View style={{ paddingBottom: insets.bottom + 8 }} className="max-h-[80%] rounded-t-2xl bg-surface dark:bg-slate-900">
        <View className="flex-row items-center justify-between border-b border-ink-200 px-4 py-3 dark:border-slate-800">
          <Text className="flex-1 text-base font-bold text-ink-900 dark:text-white">{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" className="h-10 w-10 items-center justify-center rounded-full active:bg-ink-100 dark:active:bg-slate-800">
            <X color={colors.text} size={20} />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function Toggle({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-semibold text-ink-900 dark:text-white">{label}</Text>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.accent, false: colors.border }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );
}

/** Pill buttons for picking one of a few values (filters, tabs within a page). */
export function Chips({ options, value, onChange }: { options: Option[]; value: string; onChange: (value: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={`min-h-9 justify-center rounded-full border px-3.5 ${active ? 'border-obsidian bg-obsidian dark:border-limeAccent dark:bg-limeAccent' : 'border-ink-300 bg-surface dark:border-slate-700 dark:bg-slate-900'}`}
          >
            <Text className={`text-[13px] font-bold ${active ? 'text-white dark:text-obsidian' : 'text-ink-700 dark:text-slate-200'}`}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── Status ─────────────────────────────────────────────────────────────────────

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const styles = {
    neutral: 'bg-ink-100 dark:bg-slate-800',
    good: 'bg-green-100 dark:bg-green-950',
    warn: 'bg-amber-100 dark:bg-amber-950',
    bad: 'bg-red-100 dark:bg-red-950',
    info: 'bg-sky-100 dark:bg-sky-950',
  }[tone];
  const text = {
    neutral: 'text-ink-700 dark:text-slate-200',
    good: 'text-green-800 dark:text-green-300',
    warn: 'text-amber-800 dark:text-amber-300',
    bad: 'text-red-800 dark:text-red-300',
    info: 'text-sky-800 dark:text-sky-300',
  }[tone];
  return (
    <View className={`self-start rounded-md px-2 py-0.5 ${styles}`}>
      <Text className={`text-xs font-bold ${text}`}>{label}</Text>
    </View>
  );
}

/** A message in a coloured box: errors, confirmations, notes. */
export function Notice({ text, tone = 'info', action }: { text: string; tone?: Tone; action?: ReactNode }) {
  const styles = {
    neutral: 'border-ink-200 bg-ink-50 dark:border-slate-800 dark:bg-slate-900',
    good: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950',
    warn: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
    bad: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
    info: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950',
  }[tone];
  const text2 = {
    neutral: 'text-ink-700 dark:text-slate-200',
    good: 'text-green-900 dark:text-green-200',
    warn: 'text-amber-900 dark:text-amber-200',
    bad: 'text-red-800 dark:text-red-200',
    info: 'text-sky-900 dark:text-sky-200',
  }[tone];
  return (
    <View accessibilityRole={tone === 'bad' ? 'alert' : undefined} className={`gap-2 rounded-lg border p-3 ${styles}`}>
      <Text className={`text-sm font-semibold leading-5 ${text2}`}>{text}</Text>
      {action}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View className="min-h-48 flex-1 items-center justify-center">
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <View className="items-center gap-2 rounded-xl border border-dashed border-ink-300 p-6 dark:border-slate-700">
      <Text className="text-center text-base font-bold text-ink-900 dark:text-white">{title}</Text>
      {text ? <Muted className="text-center">{text}</Muted> : null}
      {action}
    </View>
  );
}

/** Shown when a page couldn't load: the reason and a Retry button. Never stand-in data. */
export function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-3 rounded-xl border border-ink-200 bg-surface p-6 dark:border-slate-800 dark:bg-slate-900">
      <Text className="text-center text-[15px] font-semibold text-ink-900 dark:text-white">{message}</Text>
      <Button label={t('m.retry')} variant="outline" onPress={onRetry} small />
    </View>
  );
}

export function Avatar({ name, size = 44, tone = 'dark' }: { name: string; size?: number; tone?: 'dark' | 'lime' }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={`items-center justify-center ${tone === 'lime' ? 'bg-limeAccent' : 'bg-obsidian dark:bg-slate-700'}`}
    >
      <Text style={{ fontSize: size * 0.36 }} className={`font-bold ${tone === 'lime' ? 'text-obsidian' : 'text-white'}`}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** A thin progress bar (contracts, profile completeness). */
export function Progress({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800">
      <View style={{ width: `${percent}%` }} className="h-2 rounded-full bg-forest dark:bg-limeAccent" />
    </View>
  );
}

/** A date field that opens the phone's calendar. Value is YYYY-MM-DD, or '' when not chosen. */
export function DateField({ label, value, onChange, minimumDate, error }: { label: string; value: string; onChange: (value: string) => void; minimumDate?: Date; error?: string }) {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const shown = value ? new Date(`${value}T12:00:00`).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-ink-900 dark:text-white">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        className={`min-h-12 flex-row items-center justify-between rounded-lg border bg-surface px-3.5 dark:bg-slate-950 ${error ? 'border-red-500' : 'border-ink-300 dark:border-slate-700'}`}
      >
        <Text className={`text-base ${value ? 'text-ink-900 dark:text-white' : 'text-ink-400'}`}>{shown || t('m.pickDate')}</Text>
        <ChevronDown color={colors.muted} size={18} />
      </Pressable>
      {error ? <Text className="text-[13px] font-semibold text-red-700 dark:text-red-300">{error}</Text> : null}
      {open ? (
        <DateTimePicker
          value={value ? new Date(`${value}T12:00:00`) : minimumDate ?? new Date()}
          mode="date"
          minimumDate={minimumDate}
          onChange={(event, picked) => {
            setOpen(false);
            if (event.type === 'set' && picked) {
              const y = picked.getFullYear();
              const m = String(picked.getMonth() + 1).padStart(2, '0');
              const d = String(picked.getDate()).padStart(2, '0');
              onChange(`${y}-${m}-${d}`);
            }
          }}
        />
      ) : null}
    </View>
  );
}

/** A date and time field: Android asks for the day, then the time. Value is an ISO string or ''. */
export function DateTimeField({ label, value, onChange, minimumDate }: { label: string; value: string; onChange: (value: string) => void; minimumDate?: Date }) {
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const [step, setStep] = useState<'closed' | 'date' | 'time'>('closed');
  const [day, setDay] = useState<Date | null>(null);
  const current = value ? new Date(value) : null;
  let shown = '';
  if (current) {
    try {
      shown = current.toLocaleString(locale === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      shown = current.toISOString().replace('T', ' ').slice(0, 16);
    }
  }
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-ink-900 dark:text-white">{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setStep('date')} className="min-h-12 flex-row items-center justify-between rounded-lg border border-ink-300 bg-surface px-3.5 dark:border-slate-700 dark:bg-slate-950">
        <Text className={`text-base ${shown ? 'text-ink-900 dark:text-white' : 'text-ink-400'}`}>{shown || t('m.pickDate')}</Text>
        <ChevronDown color={colors.muted} size={18} />
      </Pressable>
      {step === 'date' ? (
        <DateTimePicker
          value={current ?? minimumDate ?? new Date()}
          mode="date"
          minimumDate={minimumDate}
          onChange={(event, picked) => {
            if (event.type === 'set' && picked) {
              setDay(picked);
              setStep('time');
            } else setStep('closed');
          }}
        />
      ) : null}
      {step === 'time' ? (
        <DateTimePicker
          value={current ?? day ?? new Date()}
          mode="time"
          is24Hour
          onChange={(event, picked) => {
            setStep('closed');
            if (event.type === 'set' && picked && day) {
              const combined = new Date(day);
              combined.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
              onChange(combined.toISOString());
            }
          }}
        />
      ) : null}
    </View>
  );
}
