import AuthShell from "@/components/AuthShell";
import LoginForm from "@/components/LoginForm";
import { loginPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = loginPageMetadata();

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to your Beleqet account.">
      <LoginForm />
    </AuthShell>
  );
}
