import { ipcMain } from 'electron';
import { db } from '../models/app-database';
import { shiftDate, today, transactionDelta } from '../shared/financial';

interface HistoryFilters {
  search: string;
  from: string;
  to: string;
  type: string;
  accountId: number;
  category: string;
}

interface RecurringProjection {
  type: 'income' | 'expense';
  amountCents: number;
  nextDate: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  endDate: string | null;
}

export class AnalyticsController {
  register(): void {
    ipcMain.handle('history:search', (_event, input: Record<string, unknown>) =>
      this.searchHistory(input)
    );
    ipcMain.handle('statistics:get', (_event, input: Record<string, unknown>) =>
      this.getStatistics(input)
    );
    ipcMain.handle('forecast:get', (_event, input: Record<string, unknown>) =>
      this.getForecast(input)
    );
  }

  private searchHistory(input: Record<string, unknown>) {
    const filters = this.parseHistoryFilters(input);

    return db.prepare(`
      SELECT
        t.id, t.account_id AS accountId, t.date, t.type,
        t.amount_cents AS amountCents, t.category, t.note,
        a.name AS accountName
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE t.date BETWEEN ? AND ?
        AND (
          ? = ''
          OR t.note LIKE '%' || ? || '%'
          OR t.category LIKE '%' || ? || '%'
        )
        AND (? = '' OR t.type = ?)
        AND (? = 0 OR t.account_id = ?)
        AND (? = '' OR t.category = ?)
      ORDER BY t.date DESC, t.id DESC
    `).all(
      filters.from,
      filters.to,
      filters.search,
      filters.search,
      filters.search,
      filters.type,
      filters.type,
      filters.accountId,
      filters.accountId,
      filters.category,
      filters.category
    );
  }

  private getStatistics(input: Record<string, unknown>) {
    const from = String(input.from ?? '0000-01-01');
    const to = String(input.to ?? '9999-12-31');

    return {
      byMonth: this.getMonthlyStatistics(from, to),
      byCategory: this.getCategoryStatistics(from, to)
    };
  }

  private getForecast(input: Record<string, unknown>) {
    const days = this.parseForecastDays(input.days);
    let balance = this.getActiveBalance();
    const recurring = this.getActiveRecurringTransactions();
    const points: Array<{ date: string; balanceCents: number }> = [];
    const startDate = new Date(`${today()}T12:00:00Z`);

    for (let offset = 0; offset <= days; offset += 1) {
      const date = this.dateAfter(startDate, offset);
      balance += this.getDueAmount(date, recurring);
      points.push({ date, balanceCents: balance });
    }

    return {
      days,
      points,
      assumptions: [
        'Solde actuel des comptes actifs',
        'Échéances récurrentes actives uniquement',
        'Aucune opération future manuelle inventée'
      ]
    };
  }

  private parseHistoryFilters(input: Record<string, unknown>): HistoryFilters {
    return {
      search: String(input.search ?? '').trim().slice(0, 100),
      from: String(input.from ?? '0000-01-01'),
      to: String(input.to ?? '9999-12-31'),
      type: String(input.type ?? ''),
      accountId: Number(input.accountId ?? 0),
      category: String(input.category ?? '')
    };
  }

  private parseForecastDays(rawDays: unknown): number {
    const days = Number(rawDays ?? 30);
    return Math.min(366, Math.max(1, Number.isFinite(days) ? days : 30));
  }

  private getMonthlyStatistics(from: string, to: string) {
    return db.prepare(`
      SELECT
        substr(date, 1, 7) AS month,
        SUM(CASE WHEN type = 'income' AND transfer_group IS NULL
          THEN amount_cents ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' AND transfer_group IS NULL
          THEN amount_cents ELSE 0 END) AS expenses
      FROM transactions
      WHERE date BETWEEN ? AND ?
      GROUP BY substr(date, 1, 7)
      ORDER BY month
    `).all(from, to);
  }

  private getCategoryStatistics(from: string, to: string) {
    return db.prepare(`
      SELECT category, SUM(amount_cents) AS amountCents
      FROM transactions
      WHERE type = 'expense'
        AND transfer_group IS NULL
        AND date BETWEEN ? AND ?
      GROUP BY category
      ORDER BY amountCents DESC
    `).all(from, to);
  }

  private getActiveBalance(): number {
    const result = db
      .prepare('SELECT COALESCE(SUM(balance_cents), 0) AS balance FROM accounts WHERE archived = 0')
      .get() as { balance: number };
    return result.balance;
  }

  private getActiveRecurringTransactions(): RecurringProjection[] {
    return db.prepare(`
      SELECT
        type, amount_cents AS amountCents, next_date AS nextDate,
        frequency, end_date AS endDate
      FROM recurring_transactions
      WHERE active = 1
    `).all() as RecurringProjection[];
  }

  private dateAfter(startDate: Date, offset: number): string {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  private getDueAmount(date: string, recurring: RecurringProjection[]): number {
    return recurring.reduce((total, item) => {
      let dueDate = item.nextDate;

      while (dueDate < date && this.isBeforeEndDate(dueDate, item.endDate)) {
        dueDate = shiftDate(dueDate, item.frequency);
      }

      const isDue = dueDate === date && this.isBeforeEndDate(dueDate, item.endDate);
      return isDue ? total + transactionDelta(item.type, item.amountCents) : total;
    }, 0);
  }

  private isBeforeEndDate(date: string, endDate: string | null): boolean {
    return endDate === null || date <= endDate;
  }
}
