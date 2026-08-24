import { AppError, describeError, isRetryable } from '@/lib/errors';

const pgError = (code: string, message = '') => ({
  code,
  message,
  details: '',
  hint: '',
  name: 'PostgrestError',
});

describe('describeError', () => {
  it('passes through an explicit AppError key', () => {
    expect(describeError(new AppError('tooLarge'))).toBe('tooLarge');
  });

  it('maps an RLS rejection to an authorization message', () => {
    expect(describeError(pgError('42501', 'new row violates row-level security policy'))).toBe(
      'unauthorized',
    );
  });

  it('recognises a ban ahead of the generic privilege error', () => {
    // The RPC raises 42501 with a specific message; the ban must win, so the
    // user is told their account is restricted rather than a bare "no".
    expect(describeError(pgError('42501', 'account restricted'))).toBe('banned');
  });

  it('maps the rate limiter to its own message', () => {
    expect(describeError(pgError('P0001', 'rate limit exceeded for message'))).toBe('rateLimited');
  });

  it('maps a duplicate username', () => {
    expect(describeError(pgError('23505', 'duplicate key value'))).toBe('usernameTaken');
    expect(describeError(pgError('P0001', 'username unavailable'))).toBe('usernameTaken');
  });

  it('maps a missing row', () => {
    expect(describeError(pgError('PGRST116', 'no rows'))).toBe('notFound');
  });

  it('maps an expired session', () => {
    expect(describeError(pgError('PGRST301', 'JWT expired'))).toBe('sessionExpired');
  });

  it('treats a fetch TypeError as an offline device', () => {
    expect(describeError(new TypeError('Network request failed'))).toBe('network');
  });

  it('falls back to generic for anything unrecognised', () => {
    expect(describeError({ weird: true })).toBe('generic');
    expect(describeError(null)).toBe('generic');
  });

  it('maps a blocked recipient', () => {
    expect(describeError(pgError('42501', 'cannot message this user'))).toBe('blockedUser');
  });
});

describe('isRetryable', () => {
  it('retries transient failures', () => {
    expect(isRetryable(new TypeError('fetch failed'))).toBe(true);
  });

  it('does not retry an authorization failure', () => {
    // Re-issuing a request RLS already refused just burns a round trip.
    expect(isRetryable(pgError('42501', 'denied'))).toBe(false);
  });

  it('does not retry a ban', () => {
    expect(isRetryable(pgError('42501', 'account restricted'))).toBe(false);
  });
});
