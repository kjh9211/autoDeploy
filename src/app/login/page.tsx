import { LoginForm } from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const rawNext = searchParams.next;
  const next = typeof rawNext === "string" ? rawNext : "/";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Ops Console</h1>
        <p className="mb-6 text-sm text-black/60 dark:text-white/60">
          관리자 계정으로 로그인하세요.
        </p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
