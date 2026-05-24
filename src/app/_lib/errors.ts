export class UnauthorizedError extends Error {
  readonly code = "unauthorized";
  constructor(message = "Authentication required") {
    super(message);
  }
}

export class ReauthRequiredError extends Error {
  readonly code = "reauth_required";
  constructor(message = "GitHub re-authentication required") {
    super(message);
  }
}

export class BadRequestError extends Error {
  readonly code = "bad_request";
  readonly issues: unknown;
  constructor(message: string, issues?: unknown) {
    super(message);
    this.issues = issues;
  }
}
