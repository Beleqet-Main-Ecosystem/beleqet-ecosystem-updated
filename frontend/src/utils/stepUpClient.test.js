const { clearStepUpToken, buildHeaders, getStepUpToken, setStepUpToken } = require('./stepUpClient');

describe('stepUpClient helpers', () => {
  beforeEach(() => {
    clearStepUpToken();
  });

  it('stores and exposes the current step-up token', () => {
    setStepUpToken('token-123');

    expect(getStepUpToken()).toBe('token-123');
    expect(buildHeaders('access-token')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer access-token',
      'x-step-up-token': 'token-123',
    });
  });

  it('clears the step-up token when requested', () => {
    setStepUpToken('token-123');
    clearStepUpToken();

    expect(getStepUpToken()).toBeNull();
    expect(buildHeaders()).toEqual({ 'Content-Type': 'application/json' });
  });
});
