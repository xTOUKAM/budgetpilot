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
      SELECT id, category, limit_cents AS limitCents
      FROM budgets
      WHERE month = ?
      ORDER BY category
    `).all(month);
  }

  private getSavingsGoals() {
    return db.prepare(`
      SELECT id, name, target_cents AS targetCents, saved_cents AS savedCents
      FROM savings_goals
      ORDER BY name
    `).all();
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
        frequency, next_date AS nextDate, active
      FROM recurring_transactions
      ORDER BY next_date
    `).all();
  }
}
