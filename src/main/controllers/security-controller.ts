import { app, ipcMain, safeStorage } from 'electron';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PIN_FILE = 'security-pin.dat';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30_000;

export class SecurityController {
  private failedAttempts = 0;
  private lockedUntil = 0;

  register(): void {
    ipcMain.handle('security:status', () => ({ configured: this.isConfigured() }));
    ipcMain.handle('security:set-pin', (_event, input: { pin?: string }) => this.setPin(input?.pin));
    ipcMain.handle('security:verify-pin', (_event, input: { pin?: string }) => this.verifyPin(input?.pin));
    ipcMain.handle('security:remove-pin', (_event, input: { pin?: string }) => this.removePin(input?.pin));
  }

  private setPin(pin?: string) {
    this.validatePin(pin);
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Le stockage sécurisé Windows est indisponible.');
    }
    writeFileSync(this.getPinPath(), safeStorage.encryptString(pin as string));
    this.failedAttempts = 0;
    this.lockedUntil = 0;
    return { configured: true };
  }

  private verifyPin(pin?: string): boolean {
    if (!this.isConfigured()) return true;
    if (Date.now() < this.lockedUntil) {
      const seconds = Math.ceil((this.lockedUntil - Date.now()) / 1000);
      throw new Error(`Trop de tentatives. Réessayez dans ${seconds} seconde(s).`);
    }
    if (!pin || !safeStorage.isEncryptionAvailable()) return false;
    try {
      const valid = safeStorage.decryptString(readFileSync(this.getPinPath())) === pin;
      if (valid) {
        this.failedAttempts = 0;
        return true;
      }
      this.failedAttempts += 1;
      if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        this.failedAttempts = 0;
        this.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      }
      return false;
    } catch {
      return false;
    }
  }

  private removePin(pin?: string) {
    if (!this.verifyPin(pin)) throw new Error('PIN incorrect.');
    if (existsSync(this.getPinPath())) unlinkSync(this.getPinPath());
    return { configured: false };
  }

  private isConfigured(): boolean {
    return existsSync(this.getPinPath());
  }

  private validatePin(pin?: string): void {
    if (!/^\d{4,6}$/.test(pin ?? '')) {
      throw new Error('Le PIN doit contenir entre 4 et 6 chiffres.');
    }
  }

  private getPinPath(): string {
    return join(app.getPath('userData'), PIN_FILE);
  }
}
