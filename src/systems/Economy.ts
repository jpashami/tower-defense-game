/** Gold and lives for one game. */
export class Economy {
  money: number;
  lives: number;

  constructor(money: number, lives: number) {
    this.money = money;
    this.lives = lives;
  }

  canAfford(cost: number): boolean {
    return this.money >= cost;
  }

  /** Takes the gold if there is enough; returns whether it did. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.money -= cost;
    return true;
  }

  earn(amount: number): void {
    this.money += amount;
  }

  loseLives(amount: number): void {
    this.lives = Math.max(0, this.lives - amount);
  }
}
