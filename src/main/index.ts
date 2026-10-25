import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './views/main-window';
import { registerControllers } from './controllers';

let mainWindow: BrowserWindow | null = null;
registerControllers();

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
