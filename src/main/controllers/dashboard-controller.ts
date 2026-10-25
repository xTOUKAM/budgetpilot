import { ipcMain } from 'electron';
import { db } from '../models/app-database';

export class DashboardController {
  register(): void {
    ipcMain.handle('dashboard:get', () => this.getDashboard());
  }

  private getDashboard() {
    const month = this.getCurrentMonth();
    return {
      ...this.getMonthTotals(month),
      accounts: this.getActiveAccounts(),
      transactions: this.getRecentTransactions(),
      categoryTotals: this.getCategoryTotals(month),
      budgets: this.getBudgets(month),
      goals: this.getSavingsGoals(),
      categories: this.getCategories(),
      recurring: this.getRecurringTransactions(),
      month
    };
  }

  private getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private getMonthTotals(month: string) {
    return db.prepare(`
      SELECT
        COALESCE(SUM(CASE
          WHEN type = 'income' AND transfer_group IS NULL
          AND substr(date, 1, 7) = ? THEN amount_cents ELSE 0 END), 0) income,
        COALESCE(SUM(CASE
          WHEN type = 'expense' AND transfer_group IS NULL
          AND substr(date, 1, 7) = ? THEN amount_cents ELSE 0 END), 0) expenses
      FROM transactions
    `).get(month, month) as { income: number; expenses: number };
  }

  private getActiveAccounts() {
    return db.prepare(`
      SELECT id, name, type, balance_cents AS balanceCents
      FROM accounts
      WHERE archived = 0
      ORDER BY name
    `).all();
  }

  private getRecentTransactions() {
    return db.prepare(`
      SELECT
        t.id, t.account_id AS accountId, t.date, t.type,
        t.amount_cents AS amountCents, t.category, t.note,
        t.transfer_group AS transferGroup,
        a.name AS accountName
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      ORDER BY t.date DESC, t.id DESC
      LIMIT 12
    `).all();
  }

  private getCategoryTotals(month: string) {
    return db.prepare(`
      SELECT category, SUM(amount_cents) AS amountCents
      FROM transactions
      WHERE type = 'expense'
        AND transfer_group IS NULL
        AND substr(date, 1, 7) = ?
      GROUP BY category
      ORDER BY amountCents DESC
    `).all(month);
  }

  private getBudgets(month: string) {
    return db.prepare(`
      SELECT
        b.id, b.category, b.limit_cents AS limitCents, b.month,
        COALESCE((
          SELECT SUM(t.amount_cents)
          FROM transactions t
          WHERE t.type = 'expense'
            AND t.transfer_group IS NULL
            AND substr(t.date, 1, 7) = b.month
            AND (
              t.category = b.category
              OR (
                instr(b.category, ' / ') = 0
                AND t.category LIKE b.category || ' / %'
              )
            )
        ), 0) AS spentCents
      FROM budgets
      AS b
      WHERE b.month = ?
      ORDER BY category
    `).all(month);
  }

  private getSavingsGoals() {
    const goals = db.prepare(`
      SELECT g.id, g.name, g.target_cents AS targetCents, g.saved_cents AS savedCents,
        g.target_date AS targetDate, g.monthly_cents AS monthlyCents,
        g.account_id AS accountId, a.name AS accountName
      FROM savings_goals g
      LEFT JOIN accounts a ON a.id = g.account_id
      ORDER BY g.name
    `).all() as Array<{
      id: number; name: string; targetCents: number; savedCents: number;
      targetDate: string | null; monthlyCents: number | null;
      accountId: number | null; accountName: string | null;
    }>;
    return goals.map(goal => ({
      ...goal,
      monthlyCents: goal.monthlyCents ?? 0,
      remainingCents: Math.max(0, goal.targetCents - goal.savedCents),
      monthsRemaining: goal.targetDate ? this.monthsUntil(goal.targetDate) : null
    }));
  }

  private monthsUntil(targetDate: string): number {
    const now = new Date();
    const target = new Date(`${targetDate}T12:00:00Z`);
    return Math.max(0, (target.getUTCFullYear() - now.getUTCFullYear()) * 12
      + target.getUTCMonth() - now.getUTCMonth());
  }

  private getCategories() {
    return db.prepare(`
      SELECT id, name, type, color, active
      FROM categories
      WHERE active = 1
      ORDER BY type, name
    `).all();
  }

  private getRecurringTransactions() {
    return db.prepare(`
      SELECT
        id, label, type, amount_cents AS amountCents, category,
        frequency, next_date AS nextDate, end_date AS endDate, active
      FROM recurring_transactions
      ORDER BY next_date
    `).all();
  }
}
