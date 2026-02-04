import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { MainNav } from '@/components/layout/main-nav';
import { UserNav } from '@/components/layout/user-nav';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="container max-w-7xl mx-auto px-6 lg:px-8 flex h-14 items-center">
          <MainNav />
          <div className="ml-auto flex items-center space-x-4">
            <UserNav user={session.user} />
          </div>
        </div>
      </header>
      <main className="container max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
