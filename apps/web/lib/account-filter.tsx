'use client';

import * as React from 'react';
import { useCreatorQuery } from './use-creator-query';

export interface FilterableAccount {
  id: string;
  username: string;
  profilePicture?: string | null;
  followersCount?: number | null;
}

interface AccountFilterContextValue {
  accounts: FilterableAccount[];
  loading: boolean;
  /** null = All accounts (the default). */
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
}

const AccountFilterContext = React.createContext<AccountFilterContextValue | null>(null);

/**
 * Shared account selection for creator pages. All accounts are selected by
 * default; individual chips narrow the selection. The accounts list reuses the
 * cached '/instagram' query, so chips add no extra server load.
 */
export function AccountFilterProvider({ children }: { children: React.ReactNode }) {
  const { data: accounts = [], loading } = useCreatorQuery<FilterableAccount[]>('/instagram');
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null);

  const value = React.useMemo<AccountFilterContextValue>(
    () => ({ accounts, loading, selectedAccountId, setSelectedAccountId }),
    [accounts, loading, selectedAccountId],
  );

  return <AccountFilterContext.Provider value={value}>{children}</AccountFilterContext.Provider>;
}

export function useAccountFilter(): AccountFilterContextValue {
  const ctx = React.useContext(AccountFilterContext);
  if (!ctx) throw new Error('useAccountFilter must be used inside AccountFilterProvider');
  return ctx;
}
