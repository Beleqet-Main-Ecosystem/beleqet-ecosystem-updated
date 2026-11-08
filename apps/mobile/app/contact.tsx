import { useState } from 'react';
import { Linking } from 'react-native';
import { Screen, Card, Muted, Field, Button, Notice } from '../components/ui';
import { send } from '../lib/api';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { errorText } from '../lib/api-error';

/** Send Beleqet a message; the API answers with a reference number. Same form as the website. */
export default function Contact() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [form, setForm] = useState({ name: user ? `${user.firstName} ${user.lastName}`.trim() : '', email: user?.email ?? '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  async function submit() {
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) return setError(t('auth.required'));
    setBusy(true);
    try {
      const result = await send<{ reference?: string }>('POST', '/contact', { ...form, name: form.name.trim(), email: form.email.trim(), subject: form.subject.trim(), message: form.message.trim() });
      setReference(result.reference ?? '—');
      setForm({ ...form, subject: '', message: '' });
    } catch (failure) {
      setError(errorText(failure, t, 'm.contact.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('m.about.contact')}>
      <Muted>{t('m.contact.intro')}</Muted>
      {reference ? <Notice tone="good" text={t('m.contact.sent', { reference })} /> : null}
      <Card>
        <Field label={t('m.contact.name')} value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoComplete="name" />
        <Field label={t('auth.email')} value={form.email} onChangeText={(email) => setForm({ ...form, email })} keyboardType="email-address" autoCapitalize="none" />
        <Field label={t('m.contact.subject')} value={form.subject} onChangeText={(subject) => setForm({ ...form, subject })} />
        <Field label={t('m.contact.message')} value={form.message} onChangeText={(message) => setForm({ ...form, message })} multiline />
        {error ? <Notice tone="bad" text={error} /> : null}
        <Button label={t('m.contact.send')} busy={busy} onPress={submit} />
      </Card>
      <Button variant="ghost" label="support@beleqet.com" onPress={() => Linking.openURL('mailto:support@beleqet.com')} />
    </Screen>
  );
}
