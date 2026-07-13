import AuthShell from "@/components/AuthShell";
import RegisterForm from "@/components/RegisterForm";
import { registerPageMetadata } from "@/lib/seo/generate-metadata";

export const metadata = registerPageMetadata();

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle="Join Beleqet Jobs in less than a minute.">
      <RegisterForm />
    </AuthShell>
  );
}
