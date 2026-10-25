export {};

declare global {
  interface Window {
    budgetPilot: {
      getDashboard: () => Promise<DashboardData>;
      createAccount: (input: { name: string; type: string; openingBalanceCents: number }) => Promise<unknown>;
      updateAccount: (input: { id: number; name: string; type: string }) => Promise<unknown>;
      archiveAccount: (id: number) => Promise<unknown>;
      createTransaction: (input: { accountId: number; type: string; amountCents: number; date: string; category: string; note?: string }) => Promise<unknown>;
      updateTransaction: (input: { id: number; accountId: number; type: string; amountCents: number; date: string; category: string; note?: string }) => Promise<unknown>;
      deleteTransaction: (id: number) => Promise<unknown>;
      createTransfer: (input: { fromAccountId: number; toAccountId: number; amountCents: number; date: string; note?: string }) => Promise<unknown>;
      saveCategory: (input: { id?: number; name: string; type: string; color?: string }) => Promise<unknown>;
      archiveCategory: (id: number) => Promise<unknown>;
      saveBudget: (input: { category: string; limitCents: number; month: string }) => Promise<unknown>;
      saveSavingsGoal: (input: { name: string; targetCents: number; savedCents: number }) => Promise<unknown>;
      saveRecurring: (input: unknown) => Promise<unknown>;
      toggleRecurring: (input: { id: number; active: boolean }) => Promise<unknown>;
      runDueRecurring: () => Promise<{ created: number }>;
      searchHistory: (input: unknown) => Promise<DashboardData['transactions']>;
      getStatistics: (input: { from: string; to: string }) => Promise<{ byMonth: Array<{ month: string; income: number; expenses: number }>; byCategory: Array<{ category: string; amountCents: number }> }>;
      getForecast: (input: { days: number }) => Promise<{ days: number; points: Array<{ date: string; balanceCents: number }>; assumptions: string[] }>;
      backup: () => Promise<{ canceled: boolean; filePath?: string }>;
      restore: () => Promise<{ canceled: boolean; backup?: string; requiresRestart?: boolean }>;
      exportCsv: () => Promise<string>;
    };
  }

  interface DashboardData {
    income: number;
    expenses: number;
    accounts: Array<{ id: number; name: string; type: string; balanceCents: number }>;
    transactions: Array<{ id: number; accountId: number; date: string; type: string; amountCents: number; category: string; note: string; accountName: string }>;
    categoryTotals: Array<{ category: string; amountCents: number }>;
    budgets: Array<{ id: number; category: string; limitCents: number }>;
    goals: Array<{ id: number; name: string; targetCents: number; savedCents: number }>;
    categories: Array<{ id: number; name: string; type: string; color: string; active: number }>;
    recurring: Array<{ id: number; label: string; type: string; amountCents: number; category: string; frequency: string; nextDate: string; active: number }>;
    month: string;
  }
}
