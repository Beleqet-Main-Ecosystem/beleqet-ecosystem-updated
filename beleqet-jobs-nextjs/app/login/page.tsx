import AuthShell from "@/components/AuthShell";
import LoginForm from "@/components/LoginForm";

export const metadata = {
  title: "Sign In | Beleqet Jobs",
};

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to your Beleqet account.">
      <LoginForm />
    </AuthShell>
  );
}
