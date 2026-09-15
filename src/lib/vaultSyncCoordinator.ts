/**
 * vaultSyncCoordinator.ts — account + cloud-sync orchestration for `useVault`.
 *
 * Responsibilities:
 *   - Sign in / sign up / recover → hold the **VMK only in memory** on this
 *     instance (never written to localStorage / IndexedDB / Supabase).
 *   - Pull holdings from Supabase after unlocking (`pullVault`, decrypts with VMK).
 *   - Push the full holdings list after every mutation (`pushVault`).
 *   - Sign out → always clear the VMK, even if the network call fails.
 *
 * Deliberately plain TypeScript (no React) so the whole sync lifecycle is
 * unit-testable with mocked `account` / `vaultSync` services.
 */

import type { Holding } from '../types';
import {
  signIn as accountSignIn,
  signUp as accountSignUp,
  signOut as accountSignOut,
  recoverKey as accountRecoverKey,
  type AccountSession,
} from './account';
import { pushVault, pullVault } from './vaultSync';

export class VaultSyncCoordinator {
  private userId: string | null = null;
  private vmk: CryptoKey | null = null;
  private holdings: Holding[] = [];

  /** True when a session + VMK is held in memory. */
  get isSignedIn(): boolean {
    return this.userId !== null && this.vmk !== null;
  }

  get sessionUserId(): string | null {
    return this.userId;
  }

  /** The most recently pulled (or pushed) holdings for the session. */
  get sessionHoldings(): Holding[] {
    return this.holdings;
  }

  /** Sign in with email/password, unwrap the VMK, then pull the remote vault. */
  async signIn(email: string, password: string): Promise<void> {
    await this.adopt(await accountSignIn(email, password));
  }

  /** Create an account, generate the key hierarchy, then pull (empty) vault. */
  async signUp(email: string, password: string): Promise<void> {
    await this.adopt(await accountSignUp(email, password));
  }

  /** After a password reset: recover the VMK and re-wrap it under the new password. */
  async recoverKey(newPassword: string): Promise<void> {
    await this.adopt(await accountRecoverKey(newPassword));
  }

  /** Persist the full holdings list to Supabase (encrypted under the VMK). */
  async pushHoldings(holdings: Holding[]): Promise<void> {
    this.assertSignedIn();
    await pushVault(this.userId!, holdings, this.vmk!);
    this.holdings = holdings;
  }

  /**
   * End the session. The VMK is cleared from memory unconditionally — even if the
   * Supabase sign-out call fails, the local key material must not survive.
   */
  async signOut(): Promise<void> {
    try {
      if (this.isSignedIn) {
        await accountSignOut();
      }
    } finally {
      this.userId = null;
      this.vmk = null;
      this.holdings = [];
    }
  }

  /**
   * Adopt a fresh session. If the remote pull fails (e.g. network), roll back to
   * a signed-out state so the UI never holds a VMK without matching holdings.
   */
  private async adopt(session: AccountSession): Promise<void> {
    this.userId = session.userId;
    this.vmk = session.vmk;
    try {
      this.holdings = await pullVault(session.userId, session.vmk);
    } catch (err) {
      this.userId = null;
      this.vmk = null;
      this.holdings = [];
      throw err;
    }
  }

  private assertSignedIn(): void {
    if (!this.isSignedIn) {
      throw new Error('Not signed in.');
    }
  }
}