import SignInForm from '@/features/auth/components/SignInForm';
import { loginPageMetadata } from '@/lib/seo/generate-metadata';

export const metadata = loginPageMetadata();

export default function LoginPage() {
  return <SignInForm />;
}
