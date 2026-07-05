import AuthShell from "@/components/AuthShell";
import RegisterForm from "@/components/RegisterForm";

export const metadata = {
  title: "Create Account | Beleqet Jobs",
};

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle="Join Beleqet Jobs in less than a minute.">
      <RegisterForm />
    </AuthShell>
  );
}
