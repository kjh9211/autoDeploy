import Link from "next/link";
import { requireSessionUser } from "@/lib/auth/guard";

const NAV_ITEMS = [
  { href: "/", label: "대시보드" },
  { href: "/apps", label: "앱" },
  { href: "/deploys", label: "배포" },
  { href: "/proxy", label: "프록시" },
  { href: "/dns", label: "DNS" },
  { href: "/audit", label: "감사 로그" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSessionUser();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-black/10 dark:border-white/10 p-4 flex flex-col gap-6">
        <div>
          <p className="font-semibold">Ops Console</p>
          <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
            {user.email}
          </p>
        </div>

        <nav className="flex flex-col gap-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form action="/api/logout" method="post" className="mt-auto">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-1.5 text-left text-sm text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10"
          >
            로그아웃
          </button>
        </form>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
