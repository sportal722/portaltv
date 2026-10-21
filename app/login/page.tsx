import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
export default function Login() {
  return (
    <main className="auth-page">
      <Link href="/" className="footer-brand">
        ← NEXORA
      </Link>
      <AuthForm />
      <Link href="/register">¿Primera vez? Crear cuenta</Link>
    </main>
  );
}
