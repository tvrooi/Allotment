/** A refusal from the investments services, answered with its status and message */
export class InvestmentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
