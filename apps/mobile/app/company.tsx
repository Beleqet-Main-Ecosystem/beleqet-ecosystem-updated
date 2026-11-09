import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Screen, Card, H2, Muted, Field, Select, Button, Notice, Failed, Loading, Badge, Empty, Body } from '../components/ui';
import { Logo } from '../components/cards';
import { fetchCompany, fetchMyJobs, saveCompany, submitLicence, type Company } from '../api/employer';
import { uploadFile } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { plainText, safeHttpUrl } from '../lib/format';

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];
const MAX_BYTES = 10 * 1024 * 1024;

/** The employer's company: view, edit (logo included), and send a trade licence for verification. */
export default function CompanyScreen() {
  const { t } = useTranslation();
  const load = useLoad(() => Promise.all([fetchCompany(), fetchMyJobs().catch(() => [])]), []);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Company | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'logo' | 'licence'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (load.loading) return <Screen title={t('emp.tabs.company')}><Loading /></Screen>;
  if (load.error || !load.data) return <Screen title={t('emp.tabs.company')}><Failed message={errorText(load.error, t)} onRetry={load.reload} /></Screen>;
  const [company, jobs] = load.data;
  const setCompany = (next: Company) => load.setData(([, list] = [null, []]) => [next, list]);

  if (!company) {
    return (
      <Screen title={t('emp.tabs.company')}>
        <Empty title={t('postJob.companyTitle')} text={t('postJob.companyText')} action={<Button small label={t('postJob.title')} onPress={() => router.push('/post-job')} />} />
      </Screen>
    );
  }

  const openJobs = jobs.filter((job) => job.status === 'PUBLISHED').length;
  const status = company.verified ? 'VERIFIED' : company.verificationStatus ?? 'NONE';
  const website = safeHttpUrl(company.website);

  async function changeLogo() {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > MAX_BYTES) return setError(t('emp.fileTooBig'));
    setBusy('logo');
    try {
      const logoUrl = await uploadFile({ uri: asset.uri, name: asset.fileName ?? 'logo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' });
      setCompany(await saveCompany({ logoUrl }));
    } catch (failure) {
      setError(errorText(failure, t, 'emp.uploadFailed'));
    } finally {
      setBusy('');
    }
  }

  async function sendLicence() {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > MAX_BYTES) return setError(t('emp.fileTooBig'));
    setBusy('licence');
    try {
      const tradeLicenseUrl = await uploadFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
      const updated = await submitLicence(tradeLicenseUrl);
      setCompany({ ...company!, ...updated });
      setNotice(t('emp.licenceSent'));
    } catch (failure) {
      setError(errorText(failure, t, 'emp.licenceFailed'));
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setError(t('emp.nameNeeded'));
    if (draft.website?.trim() && !safeHttpUrl(draft.website)) return setError(t('postJob.errUrl'));
    setBusy('save');
    setError('');
    try {
      const saved = await saveCompany({
        name: draft.name.trim(),
        industry: draft.industry?.trim() || null,
        location: draft.location?.trim() || null,
        size: draft.size || null,
        description: draft.description?.trim() || null,
        website: draft.website?.trim() || '',
      });
      setCompany(saved);
      setEditing(false);
      setNotice(company!.verified && !saved.verified ? t('emp.renamedUnverified') : t('emp.companySaved'));
    } catch (failure) {
      setError(errorText(failure, t, 'dash.saveFailed'));
    } finally {
      setBusy('');
    }
  }

  return (
    <Screen title={t('emp.tabs.company')} refreshing={load.refreshing} onRefresh={load.refresh}>
      <Muted>{t('emp.companySub')}</Muted>
      {error ? <Notice tone="bad" text={error} /> : null}
      {notice ? <Notice tone="good" text={notice} /> : null}

      {editing && draft ? (
        <Card>
          {company.verified ? <Notice tone="warn" text={t('emp.renameWarning')} /> : null}
          {(['name', 'industry', 'location', 'website'] as const).map((field) => (
            <Field key={field} label={t(`postJob.company.${field}`)} value={draft[field] ?? ''} onChangeText={(value) => setDraft({ ...draft, [field]: value })} autoCapitalize={field === 'website' ? 'none' : 'sentences'} keyboardType={field === 'website' ? 'url' : 'default'} />
          ))}
          <Select label={t('emp.size')} value={draft.size ?? ''} onChange={(size) => setDraft({ ...draft, size })} options={[{ value: '', label: t('postJob.notSpecified') }, ...SIZES.map((size) => ({ value: size, label: size }))]} />
          <Field label={t('postJob.company.description')} value={draft.description ?? ''} onChangeText={(description) => setDraft({ ...draft, description })} multiline />
          <View className="flex-row gap-2">
            <Button className="flex-1" variant="outline" label={t('postJob.cancel')} onPress={() => setEditing(false)} />
            <Button className="flex-1" label={t('postJob.save')} busy={busy === 'save'} onPress={save} />
          </View>
        </Card>
      ) : (
        <Card>
          <View className="flex-row items-center gap-3">
            <Logo name={company.name} url={safeHttpUrl(company.logoUrl)} size={64} />
            <View className="flex-1 gap-0.5">
              <Text className="text-lg font-bold text-ink-900 dark:text-white">{company.name}</Text>
              <Muted>{[company.industry, company.location, company.size ? `${company.size} ${t('job.employees')}` : null].filter(Boolean).join(' · ')}</Muted>
              <Muted>{t('emp.openCount', { count: openJobs })}</Muted>
            </View>
          </View>
          {company.description ? <Body>{plainText(company.description)}</Body> : null}
          {website ? <Button small variant="ghost" label={website} onPress={() => Linking.openURL(website)} /> : null}
          <View className="flex-row gap-2">
            <Button className="flex-1" small variant="outline" label={t('m.company.changeLogo')} busy={busy === 'logo'} onPress={changeLogo} />
            <Button className="flex-1" small label={t('emp.editCompany')} onPress={() => { setDraft(company); setEditing(true); }} />
          </View>
        </Card>
      )}

      <Card>
        <H2>{t('emp.verification')}</H2>
        <Badge label={t(`emp.verifyStatus.${status}`)} tone={status === 'VERIFIED' ? 'good' : status === 'REJECTED' ? 'bad' : status === 'PENDING' ? 'warn' : 'neutral'} />
        <Muted>{t(`emp.verifyText.${status}`)}</Muted>
        {status === 'NONE' || status === 'REJECTED' ? <Button small variant="outline" label={t('m.company.sendLicence')} busy={busy === 'licence'} onPress={sendLicence} /> : null}
      </Card>
    </Screen>
  );
}
