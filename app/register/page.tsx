import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
export default function Register() {
  return (
    <main className="auth-page">
      <Link href="/" className="footer-brand">
        ← NEXORA
      </Link>
      <AuthForm initialMode="register" />
      <Link href="/login">Ya tengo una cuenta</Link>
    </main>
  );
}
