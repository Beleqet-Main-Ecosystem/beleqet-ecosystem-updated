'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { forumCard, forumSolid } from '@/features/forum/ForumList';
import { getToken } from '@/lib/auth';
import { FORUM_CONFIG } from '@/lib/config/forum';
import { createThread } from '@/lib/forum-api';
import { useTranslation } from '@/lib/i18n';

const { MIN_TITLE_LENGTH, MAX_TITLE_LENGTH, MIN_CONTENT_LENGTH, MAX_CONTENT_LENGTH, MAX_TAGS, MAX_TAG_LENGTH } = FORUM_CONFIG.VALIDATION;
const input = 'min-h-12 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const hint = 'text-[13px] text-ink-500 dark:text-slate-400';

export default function NewThreadPage() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent('/forum/new')}`);
  }, [ready, user, router]);

  if (!ready || !user) return <div className="min-h-[60vh]" />;

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, MAX_TAG_LENGTH);
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) setTags([...tags, tag]);
    setTagInput('');
  }

  function onTagKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(tagInput);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim().length < MIN_TITLE_LENGTH) return setError(t('forum.errTitle'));
    if (content.trim().length < MIN_CONTENT_LENGTH) return setError(t('forum.errContent'));
    const token = getToken();
    if (!token) return router.replace('/login?next=/forum/new');
    setError('');
    setSubmitting(true);
    try {
      const thread = await createThread({ title: title.trim(), content: content.trim(), tags, isAnonymous: anonymous }, token);
      router.push(`/forum/${thread.id}`);
    } catch {
      setError(t('forum.postFailed'));
      setSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-6 md:py-10">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink-900 dark:text-white">{t('forum.start')}</h1>
      <section className={`${forumCard} flex flex-col gap-4`}>
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between gap-3 text-sm font-bold text-ink-900 dark:text-white"><span>{t('forum.titleLabel')}</span><span className={hint}>{title.length} / {MAX_TITLE_LENGTH}</span></span>
          <input type="text" maxLength={MAX_TITLE_LENGTH} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('forum.titlePlaceholder')} className={input} />
          <span className={hint}>{t('forum.titleHint')}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between gap-3 text-sm font-bold text-ink-900 dark:text-white"><span>{t('forum.details')}</span><span className={hint}>{content.length.toLocaleString('en-US')} / {MAX_CONTENT_LENGTH.toLocaleString('en-US')}</span></span>
          <textarea rows={8} maxLength={MAX_CONTENT_LENGTH} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('forum.detailsPlaceholder')} className={`${input} resize-y py-3 leading-normal`} />
          <span className={hint}>{t('forum.detailsHint')}</span>
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-ink-900 dark:text-white">{t('forum.tagsLabel')} <span className="font-medium text-ink-500 dark:text-slate-400">({t('forum.upTo10')})</span></span>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-300 p-2 focus-within:ring-2 focus-within:ring-forest dark:border-slate-700">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#F1F4F6] py-1 pl-3 pr-1 text-sm font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
                #{tag}
                <button type="button" aria-label={t('forum.removeTag').replace('{tag}', tag)} onClick={() => setTags(tags.filter((item) => item !== tag))} className="grid h-7 w-7 place-items-center">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            <input
              type="text"
              aria-label={t('forum.addTag')}
              placeholder={t('forum.addTag')}
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => addTag(tagInput)}
              className="min-h-9 min-w-[160px] flex-1 bg-transparent px-1.5 text-base text-ink-900 outline-none dark:text-white"
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="mt-0.5 h-5 w-5 accent-primary" />
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px] text-ink-900 dark:text-white">{t('forum.postAnon')}</b>
            <span className={hint}>{t('forum.postAnonText')}</span>
          </span>
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className={forumSolid}>{t(submitting ? 'freelance.post2.publishing' : 'forum.publish')}</button>
        </div>
      </section>
    </form>
  );
}
