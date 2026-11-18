import { DashboardLayout } from '@/components/dashboard/layout';
import { AccountFilterProvider } from '@/lib/account-filter';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountFilterProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AccountFilterProvider>
  );
}
