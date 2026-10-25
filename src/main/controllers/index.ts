import { AccountController } from './account-controller';
import { AnalyticsController } from './analytics-controller';
import { DashboardController } from './dashboard-controller';
import { DataController } from './data-controller';
import { PlanningController } from './planning-controller';
import { TransactionController } from './transaction-controller';
import { SecurityController } from './security-controller';

export function registerControllers() {
  new DashboardController().register();
  new AccountController().register();
  new TransactionController().register();
  new PlanningController().register();
  new AnalyticsController().register();
  const dataController = new DataController();
  dataController.register();
  new SecurityController().register();
  return { dataController };
}
