/**
 * One place that turns a failure into something a user can read.
 *
 * Supabase surfaces PostgREST errors with the underlying Postgres SQLSTATE in
 * `code`, so the RPCs' deliberate `errcode` choices (§32) come through here
 * and become specific, localized messages instead of "something went wrong".
 */

import type { PostgrestError } from '@supabase/supabase-js';

/** i18n key under the `errors.` namespace. */
export type ErrorKey =
  | 'generic'
  | 'network'
  | 'unauthorized'
  | 'notFound'
  | 'rateLimited'
  | 'sessionExpired'
  | 'usernameTaken'
  | 'usernameInvalid'
  | 'invalidEmail'
  | 'weakPassword'
  | 'invalidCredentials'
  | 'uploadFailed'
  | 'tooLarge'
  | 'banned'
  | 'blockedUser'
  | 'emptyMessage';

export class AppError extends Error {
  readonly key: ErrorKey;
  override readonly cause: unknown;

  constructor(key: ErrorKey, cause?: unknown) {
    super(key);
    this.name = 'AppError';
    this.key = key;
    this.cause = cause;
  }
}

const isPostgrestError = (value: unknown): value is PostgrestError =>
  typeof value === 'object' && value !== null && 'code' in value && 'message' in value;

/** Postgres SQLSTATE -> message key. */
const SQLSTATE_MAP: Record<string, ErrorKey> = {
  '42501': 'unauthorized',       // insufficient_privilege - RLS or an explicit raise
  '23505': 'usernameTaken',      // unique_violation
  '23503': 'notFound',           // foreign_key_violation
  '23514': 'generic',            // check_violation
  P0002: 'notFound',             // no_data_found
  P0001: 'rateLimited',          // raise_exception used by check_rate_limit
  '22023': 'generic',            // invalid_parameter_value
  PGRST301: 'sessionExpired',    // JWT expired
  PGRST116: 'notFound',          // no rows for .single()
};

/**
 * Messages our own RPCs raise. Matched before the generic SQLSTATE mapping so
 * "account restricted" reads as a ban rather than a bare permission error.
 */
const MESSAGE_PATTERNS: [RegExp, ErrorKey][] = [
  [/account restricted/i, 'banned'],
  [/cannot message this user|does not accept direct messages/i, 'blockedUser'],
  [/username unavailable/i, 'usernameTaken'],
  [/rate limit exceeded/i, 'rateLimited'],
  [/not authenticated/i, 'sessionExpired'],
  [/invalid login credentials/i, 'invalidCredentials'],
  [/password should be at least/i, 'weakPassword'],
  [/unable to validate email|invalid email/i, 'invalidEmail'],
  [/payload too large|exceeded the maximum allowed size/i, 'tooLarge'],
  [/fetch failed|network request failed|timeout/i, 'network'],
];

/** Map any thrown value onto a stable, translatable key. */
export const describeError = (error: unknown): ErrorKey => {
  if (error instanceof AppError) return error.key;

  const message =
    isPostgrestError(error) ? `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`
    : error instanceof Error ? error.message
    : typeof error === 'string' ? error
    : '';

  for (const [pattern, key] of MESSAGE_PATTERNS) {
    if (pattern.test(message)) return key;
  }

  if (isPostgrestError(error)) {
    const mapped = SQLSTATE_MAP[error.code];
    if (mapped) return mapped;
  }

  // A TypeError from fetch is the usual shape of "the device is offline".
  if (error instanceof TypeError) return 'network';

  return 'generic';
};

/** Convenience for callers that want the full i18n path. */
export const errorTranslationKey = (error: unknown): string => `errors.${describeError(error)}`;

/**
 * Whether retrying the same request could plausibly succeed. Used to decide
 * if a retry button is worth showing (§36) and by the query client's retry
 * policy - re-issuing a request that RLS rejected only wastes a round trip.
 */
export const isRetryable = (error: unknown): boolean => {
  const key = describeError(error);
  return key === 'network' || key === 'generic' || key === 'rateLimited';
};
