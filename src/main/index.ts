import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './views/main-window';
import { registerControllers } from './controllers';
import { PlanningController } from './controllers/planning-controller';

let mainWindow: BrowserWindow | null = null;
const { dataController } = registerControllers();

app.setAppUserModelId('fr.warble.desktop');
app.setName('Warble');

app.whenReady().then(() => {
  dataController.startAutomaticBackup();
  void runDueRecurringTransactions();
  mainWindow = createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
  });

  async function runDueRecurringTransactions(): Promise<void> {
    try {
      await new PlanningController().runDueRecurringOnStartup();
    } catch (error) {
      console.error('Impossible de générer les opérations récurrentes.', error);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
