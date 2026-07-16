'use client';

import { useCallback } from 'react';

export type ResumeBrainLocale = 'en' | 'am';

/**
 * Self-contained en/am dictionary for the Resume Brain components only.
 * No app-wide i18n library is installed in this project yet, so this keeps
 * translation scoped to this feature without touching shared routing,
 * middleware, or layout files.
 */
const dictionaries: Record<ResumeBrainLocale, Record<string, string>> = {
  en: {
    uploadTitle: 'Upload your CV',
    uploadSubtitle: 'PDF, DOC, or DOCX — max {maxSizeMb}MB',
    dropzoneText: 'Drag & drop your CV here, or click to browse',
    browseButton: 'Choose file',
    selectedFile: 'Selected file',
    removeFile: 'Remove',
    consentLabel: 'I consent to processing of my CV data',
    consentRequiredError: 'You must consent to processing of your CV data before uploading.',
    uploadButton: 'Upload & Parse',
    uploading: 'Uploading…',
    parsing: 'Parsing your CV…',
    uploadSuccess: 'Your CV was parsed successfully.',
    pageTitle: 'Upload your CV. We’ll do the typing.',
    pageSubtitle:
      'Upload a PDF or Word CV and Resume Brain extracts your education, work experience, and skills automatically — review and confirm before it fills in your profile.',
    errorGeneric: 'Something went wrong. Please try again.',
    errorFileType: 'Only PDF, DOC, and DOCX files are accepted.',
    errorFileSize: 'File exceeds the maximum size of {maxSizeMb}MB.',
    previewTitle: 'Review extracted information',
    previewSubtitle: 'Confirm or correct the details below before applying them to your profile.',
    personalInfoSection: 'Personal information',
    fullNameLabel: 'Full name',
    emailLabel: 'Email',
    phoneLabel: 'Phone',
    locationLabel: 'Location',
    educationSection: 'Education',
    institutionLabel: 'Institution',
    degreeLabel: 'Degree',
    fieldOfStudyLabel: 'Field of study',
    startDateLabel: 'Start date',
    endDateLabel: 'End date',
    workExperienceSection: 'Work experience',
    companyLabel: 'Company',
    titleLabel: 'Title',
    descriptionLabel: 'Description',
    skillsSection: 'Skills',
    certificationsSection: 'Certifications',
    languagesSection: 'Languages',
    languageLabel: 'Language',
    proficiencyLabel: 'Proficiency',
    confirmButton: 'Confirm & Autofill Profile',
    autofilling: 'Applying to profile…',
    autofillSuccess: 'Profile updated successfully.',
    addEntry: 'Add',
    removeEntry: 'Remove',
    noEducation: 'No education entries were found.',
    noExperience: 'No work experience entries were found.',
    noSkills: 'No skills were found.',
    noCertifications: 'No certifications were found.',
    noLanguages: 'No languages were found.',
  },
  am: {
    uploadTitle: 'ሲቪዎን ይላኩ',
    uploadSubtitle: 'PDF, DOC, ወይም DOCX — ከፍተኛ {maxSizeMb}ሜባ',
    dropzoneText: 'ሲቪዎን እዚህ ይጎትቱ እና ይጣሉ፣ ወይም ለመምረጥ ይጫኑ',
    browseButton: 'ፋይል ይምረጡ',
    selectedFile: 'የተመረጠ ፋይል',
    removeFile: 'አስወግድ',
    consentLabel: 'የሲቪዬ መረጃ እንዲሰራ እስማማለሁ',
    consentRequiredError: 'ከመላክዎ በፊት የሲቪዎ መረጃ እንዲሰራ ስምምነት መስጠት አለብዎት።',
    uploadButton: 'ላክ እና ተነትን',
    uploading: 'በመላክ ላይ…',
    parsing: 'ሲቪዎን በመተንተን ላይ…',
    uploadSuccess: 'ሲቪዎ በተሳካ ሁኔታ ተተንትኗል።',
    pageTitle: 'ሲቪዎን ይላኩ። እኛ እንጽፋዋለን።',
    pageSubtitle:
      'PDF ወይም Word ሲቪ ይላኩ፣ Resume Brain ትምህርትዎን፣ የስራ ልምድዎን እና ክህሎቶችዎን በአይነት ይገናኛል — በመገምገም በፊት እንዲሞሉ ያረጋግጡ።',
    errorGeneric: 'የሆነ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።',
    errorFileType: 'PDF, DOC, እና DOCX ፋይሎች ብቻ ተቀባይነት አላቸው።',
    errorFileSize: 'ፋይሉ ከፍተኛውን መጠን «{maxSizeMb}ሜባ» አልፏል።',
    previewTitle: 'የተገኘውን መረጃ ይገምግሙ',
    previewSubtitle: 'ወደ መገለጫዎ ከመተግበሩ በፊት ከዚህ በታች ያለውን መረጃ ያረጋግጡ ወይም ያስተካክሉ።',
    personalInfoSection: 'የግል መረጃ',
    fullNameLabel: 'ሙሉ ስም',
    emailLabel: 'ኢሜይል',
    phoneLabel: 'ስልክ',
    locationLabel: 'አካባቢ',
    educationSection: 'ትምህርት',
    institutionLabel: 'ተቋም',
    degreeLabel: 'ዲግሪ',
    fieldOfStudyLabel: 'የትምህርት ዘርፍ',
    startDateLabel: 'መጀመሪያ ቀን',
    endDateLabel: 'መጨረሻ ቀን',
    workExperienceSection: 'የስራ ልምድ',
    companyLabel: 'ድርጅት',
    titleLabel: 'ማዕረግ',
    descriptionLabel: 'መግለጫ',
    skillsSection: 'ክህሎቶች',
    certificationsSection: 'ማረጋገጫዎች',
    languagesSection: 'ቋንቋዎች',
    languageLabel: 'ቋንቋ',
    proficiencyLabel: 'ብቃት',
    compensationLabel: 'የሥራ ክፍያ',
    confirmButton: 'አረጋግጥ እና መገለጫ ሙላ',
    autofilling: 'ወደ መገለጫ በመተግበር ላይ…',
    autofillSuccess: 'መገለጫ በተሳካ ሁኔታ ተዘምኗል።',
    deleteResumeButton: 'የተተነሰውን ሲቪ አጥፋ',
    deleting: 'እየወገደ ነው…',
    deleteSuccess: 'የተተነሰው ሲቪ በተሳካ ሁኔታ አጥፋዋል።',
    addEntry: 'ጨምር',
    removeEntry: 'አስወግድ',
    noEducation: 'ምንም የትምህርት መረጃ አልተገኘም።',
    noExperience: 'ምንም የስራ ልምድ መረጃ አልተገኘም።',
    noSkills: 'ምንም ክህሎት አልተገኘም።',
    noCertifications: 'ምንም ማረጋገጫ አልተገኘም።',
    noLanguages: 'ምንም ቋንቋ አልተገኘም።',
  },
};

/**
 * Translation hook scoped to the Resume Brain feature. Supports `{placeholder}`
 * interpolation via the optional `args` map.
 */
export function translate(
  locale: ResumeBrainLocale,
  key: string,
  args?: Record<string, string | number>,
): string {
  const template = dictionaries[locale][key] ?? key;
  if (!args) return template;
  return Object.entries(args).reduce(
    (result, [argKey, value]) => result.replaceAll(`{${argKey}}`, String(value)),
    template,
  );
}

export function useResumeBrainI18n(initialLocale: ResumeBrainLocale = 'en') {
  const [locale, setLocale] = useState<ResumeBrainLocale>(initialLocale);

  const t = useCallback(
    (key: string, args?: Record<string, string | number>): string => translate(locale, key, args),
    [locale],
  );

  return { locale, setLocale, t };
}
