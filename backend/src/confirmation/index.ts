import crypto from 'crypto';
import db from '../database/connection';

export interface PendingAction {
  id: string;
  chatId: number;
  action: string;
  description: string;
  parameters: Record<string, any>;
  execute: () => Promise<any>;
  createdAt: number;
  expiresAt: number;
}

export class ConfirmationManager {
  private static pendingActions: Map<string, PendingAction> = new Map();
  private static DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

  /**
   * Request confirmation from the user for a high-impact or write operation (PRD Section 57).
   */
  static requestConfirmation(
    chatId: number,
    action: string,
    description: string,
    parameters: Record<string, any>,
    execute: () => Promise<any>,
    ttlMs: number = this.DEFAULT_TTL_MS
  ): PendingAction {
    const id = `act_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();

    const pendingAction: PendingAction = {
      id,
      chatId,
      action,
      description,
      parameters,
      execute,
      createdAt: now,
      expiresAt: now + ttlMs
    };

    this.pendingActions.set(id, pendingAction);
    return pendingAction;
  }

  /**
   * Confirms and executes an action.
   * Enforces strict user isolation: only the user who owns the action can confirm it (PRD Section 57).
   */
  static async confirmAction(chatId: number, actionId: string): Promise<{ success: boolean; message: string; result?: any }> {
    const action = this.pendingActions.get(actionId);

    if (!action) {
      return {
        success: false,
        message: 'Action not found or has already been executed/cancelled.'
      };
    }

    // Security Check: User isolation
    if (action.chatId !== chatId) {
      return {
        success: false,
        message: 'Unauthorized: You cannot confirm an action requested by another user.'
      };
    }

    // Check expiration
    if (Date.now() > action.expiresAt) {
      this.pendingActions.delete(actionId);
      return {
        success: false,
        message: 'This confirmation request has expired. Please initiate the request again.'
      };
    }

    try {
      const result = await action.execute();
      this.pendingActions.delete(actionId);

      // Log confirmed action
      await db('api_logs').insert({
        chat_id: chatId,
        connector: 'confirmation',
        operation: `confirm_${action.action}`,
        status: 'success'
      });

      return {
        success: true,
        message: `Action "${action.description}" completed successfully.`,
        result
      };
    } catch (err: any) {
      this.pendingActions.delete(actionId);

      await db('api_logs').insert({
        chat_id: chatId,
        connector: 'confirmation',
        operation: `confirm_${action.action}`,
        status: 'error',
        error_message: err.message
      });

      return {
        success: false,
        message: `Failed to execute action: ${err.message}`
      };
    }
  }

  /**
   * Cancels a pending action.
   */
  static cancelAction(chatId: number, actionId: string): { success: boolean; message: string } {
    const action = this.pendingActions.get(actionId);

    if (!action) {
      return {
        success: false,
        message: 'Action not found or has already expired.'
      };
    }

    if (action.chatId !== chatId) {
      return {
        success: false,
        message: 'Unauthorized: You cannot cancel an action belonging to another user.'
      };
    }

    this.pendingActions.delete(actionId);
    return {
      success: true,
      message: `Action "${action.description}" was cancelled.`
    };
  }

  /**
   * Retrieve a pending action by ID if valid and not expired.
   */
  static getPendingAction(actionId: string): PendingAction | null {
    const action = this.pendingActions.get(actionId);
    if (!action) return null;

    if (Date.now() > action.expiresAt) {
      this.pendingActions.delete(actionId);
      return null;
    }

    return action;
  }
}
