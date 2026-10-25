import { AccountController } from './account-controller';
import { AnalyticsController } from './analytics-controller';
import { DashboardController } from './dashboard-controller';
import { DataController } from './data-controller';
import { PlanningController } from './planning-controller';
import { TransactionController } from './transaction-controller';

export function registerControllers() {
  new DashboardController().register();
  new AccountController().register();
  new TransactionController().register();
  new PlanningController().register();
  new AnalyticsController().register();
  new DataController().register();
}
