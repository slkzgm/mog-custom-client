export class SerialActionQueue {
  private tail: Promise<void> = Promise.resolve();
  private pendingCount = 0;

  get size(): number {
    return this.pendingCount;
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.pendingCount += 1;

    const scheduled = this.tail.then(task, task);
    this.tail = scheduled.then(
      () => {
        this.pendingCount -= 1;
      },
      () => {
        this.pendingCount -= 1;
      },
    );

    return scheduled;
  }
}
