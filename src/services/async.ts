export class OperationTimeoutError extends Error {
  readonly code = 'operation/timeout';

  constructor(message: string) {
    super(message);
    this.name = 'OperationTimeoutError';
  }
}

// Bounds UI waiting; Firestore writes already queued by its SDK are not cancelled.
export function withTimeout<T>(promise: Promise<T>, milliseconds: number, message = 'La operación tardó demasiado.'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new OperationTimeoutError(message)), milliseconds);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
