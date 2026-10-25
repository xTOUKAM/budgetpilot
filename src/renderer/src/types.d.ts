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
      updateTransfer: (input: { transferGroup: string; fromAccountId: number; toAccountId: number; amountCents: number; date: string; note?: string }) => Promise<unknown>;
      saveCategory: (input: { id?: number; name: string; type: string; color?: string }) => Promise<unknown>;
      archiveCategory: (id: number) => Promise<unknown>;
      saveBudget: (input: { id?: number; category: string; limitCents: number; month: string }) => Promise<unknown>;
      deleteBudget: (id: number) => Promise<unknown>;
      saveSavingsGoal: (input: { id?: number; name: string; targetCents: number; savedCents: number; targetDate?: string; monthlyCents?: number; accountId?: number }) => Promise<unknown>;
      saveRecurring: (input: unknown) => Promise<unknown>;
      toggleRecurring: (input: { id: number; active: boolean }) => Promise<unknown>;
      runDueRecurring: () => Promise<{ created: number; skipped: number }>;
      searchHistory: (input: HistoryFilters) => Promise<DashboardData['transactions']>;
      getStatistics: (input: { from: string; to: string }) => Promise<StatisticsData>;
      getForecast: (input: { days: number }) => Promise<{ days: number; points: Array<{ date: string; balanceCents: number }>; assumptions: string[] }>;
      backup: (input: { password: string }) => Promise<{ canceled: boolean; filePath?: string }>;
      restore: (input: { password?: string }) => Promise<{ canceled: boolean; backup?: string; requiresRestart?: boolean }>;
      exportCsv: (input: HistoryFilters) => Promise<string>;
      importCsv: (input: { accountId: number }) => Promise<{ canceled: boolean; imported?: number; duplicates?: number }>;
      getAutoBackupStatus: () => Promise<{ enabled: boolean }>;
      setAutoBackup: (input: { enabled: boolean }) => Promise<{ enabled: boolean }>;
      getSecurityStatus: () => Promise<{ configured: boolean }>;
      setPin: (input: { pin: string }) => Promise<{ configured: boolean }>;
      verifyPin: (input: { pin: string }) => Promise<boolean>;
      removePin: (input: { pin: string }) => Promise<{ configured: boolean }>;
    };
  }

  interface StatisticsData {
    summary: { income: number; expenses: number; operations: number; averageExpense: number };
    byMonth: Array<{ month: string; income: number; expenses: number }>;
    byCategory: Array<{ category: string; amountCents: number }>;
    bySubcategory: Array<{ category: string; amountCents: number }>;
    byAccount: Array<{ accountName: string; income: number; expenses: number }>;
  }

  interface HistoryFilters {
    search: string;
    from: string;
    to: string;
    type: string;
    accountId: number;
    category: string;
    minAmount?: number;
    maxAmount?: number;
    sort?: 'date' | 'amount';
  }

  interface DashboardData {
    income: number;
    expenses: number;
    accounts: Array<{ id: number; name: string; type: string; balanceCents: number }>;
    transactions: Array<{ id: number; accountId: number; date: string; type: string; amountCents: number; category: string; note: string; accountName: string; transferGroup: string | null; fromAccountId?: number; toAccountId?: number; fromAccountName?: string; toAccountName?: string }>;
    categoryTotals: Array<{ category: string; amountCents: number }>;
    budgets: Array<{ id: number; category: string; limitCents: number; spentCents: number; month: string }>;
    goals: Array<{ id: number; name: string; targetCents: number; savedCents: number; targetDate: string | null; monthlyCents: number; accountId: number | null; accountName: string | null; remainingCents: number; monthsRemaining: number | null }>;
    categories: Array<{ id: number; name: string; type: string; color: string; active: number }>;
    recurring: Array<{ id: number; label: string; type: string; amountCents: number; category: string; frequency: string; nextDate: string; endDate: string | null; active: number }>;
    month: string;
  }
}
