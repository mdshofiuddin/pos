export interface SessionCloseResult {
  expectedCash: number;
  countedCash: number;
  variance: number;
}

export class CashSessionService {
  /**
   * Calculates cash reconciliation and variance upon closing a cash session.
   * Variance = Counted Cash - Expected Cash (negative means shortage, positive means surplus).
   */
  static calculateReconciliation(expectedCash: number, countedCash: number): SessionCloseResult {
    const variance = countedCash - expectedCash;
    return {
      expectedCash,
      countedCash,
      variance,
    };
  }

  /**
   * Computes updated session cash totals based on a new cash movement.
   */
  static applyCashMovement(
    currentTotals: { totalCashIn: number; totalCashOut: number; expectedCash: number },
    movementType: 'cash_in' | 'cash_out' | 'expense',
    amount: number
  ) {
    if (movementType === 'cash_in') {
      return {
        totalCashIn: currentTotals.totalCashIn + amount,
        totalCashOut: currentTotals.totalCashOut,
        expectedCash: currentTotals.expectedCash + amount,
      };
    } else {
      return {
        totalCashIn: currentTotals.totalCashIn,
        totalCashOut: currentTotals.totalCashOut + amount,
        expectedCash: currentTotals.expectedCash - amount,
      };
    }
  }
}
