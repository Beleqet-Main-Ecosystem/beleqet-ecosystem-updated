import { IdDocumentType } from './types';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const DOCUMENT_TYPES: {
  value: IdDocumentType;
  label: string;
  description: string;
}[] = [
  {
    value: 'NATIONAL_ID',
    label: 'National ID',
    description: 'Government-issued National ID Card',
  },
  {
    value: 'PASSPORT',
    label: 'Passport',
    description: 'International Passport',
  },
  {
    value: 'DRIVERS_LICENSE',
    label: "Driver's License",
    description: 'Government-issued Driver License',
  },
];
