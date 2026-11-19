import RegisterFlow from '@/features/auth/components/RegisterFlow';
import { registerPageMetadata } from '@/lib/seo/generate-metadata';

export const metadata = registerPageMetadata();

export default function RegisterPage() {
  return <RegisterFlow />;
}
