import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('budgetPilot', {
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  createAccount: (input: unknown) => ipcRenderer.invoke('accounts:create', input),
  updateAccount: (input: unknown) => ipcRenderer.invoke('accounts:update', input),
  archiveAccount: (id: unknown) => ipcRenderer.invoke('accounts:archive', id),
  createTransaction: (input: unknown) => ipcRenderer.invoke('transactions:create', input),
  updateTransaction: (input: unknown) => ipcRenderer.invoke('transactions:update', input),
  deleteTransaction: (id: unknown) => ipcRenderer.invoke('transactions:delete', id),
  createTransfer: (input: unknown) => ipcRenderer.invoke('transfers:create', input),
  saveCategory: (input: unknown) => ipcRenderer.invoke('categories:save', input),
  archiveCategory: (id: unknown) => ipcRenderer.invoke('categories:archive', id),
  saveBudget: (input: unknown) => ipcRenderer.invoke('budgets:save', input),
  deleteBudget: (id: unknown) => ipcRenderer.invoke('budgets:delete', id),
  saveSavingsGoal: (input: unknown) => ipcRenderer.invoke('savings:save', input),
  saveRecurring: (input: unknown) => ipcRenderer.invoke('recurring:save', input),
  toggleRecurring: (input: unknown) => ipcRenderer.invoke('recurring:toggle', input),
  runDueRecurring: () => ipcRenderer.invoke('recurring:run-due'),
  searchHistory: (input: unknown) => ipcRenderer.invoke('history:search', input),
  getStatistics: (input: unknown) => ipcRenderer.invoke('statistics:get', input),
  getForecast: (input: unknown) => ipcRenderer.invoke('forecast:get', input),
  backup: () => ipcRenderer.invoke('data:backup'),
  restore: () => ipcRenderer.invoke('data:restore'),
  exportCsv: () => ipcRenderer.invoke('data:export')
});
