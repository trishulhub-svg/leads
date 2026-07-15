// src/app/login/page.tsx
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect && /^\/(?!\/)/.test(params.redirect) ? params.redirect : "/";
  return <LoginForm redirectTo={redirectTo} />;
}
