import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

export type AccountType = 'member' | 'coach';

/** What the user picked before the sign-up form (Account type screen). Kept in memory only. */
type Draft = { accountType: AccountType | null; setAccountType: (a: AccountType) => void };

const Ctx = createContext<Draft>({ accountType: null, setAccountType: () => {} });

export function SignupDraftProvider({ children }: PropsWithChildren) {
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const value = useMemo(() => ({ accountType, setAccountType }), [accountType]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSignupDraft = () => useContext(Ctx);
