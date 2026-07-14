import { SENSITIVE_ACTION_KEY, ACTION_TYPE_KEY, SensitiveAction } from './sensitive-action.decorator';

describe('SensitiveAction decorator', () => {
  it('should define SENSITIVE_ACTION_KEY', () => {
    expect(SENSITIVE_ACTION_KEY).toBe('sensitive_action');
  });

  it('should define ACTION_TYPE_KEY', () => {
    expect(ACTION_TYPE_KEY).toBe('action_type');
  });

  it('should set SENSITIVE_ACTION_KEY metadata to true when no action is provided', () => {
    class TestController {
      @SensitiveAction()
      sensitiveMethod() { return true; }
      normalMethod() { return true; }
    }

    const instance = new TestController();
    const sensitiveMetadata = Reflect.getMetadata(SENSITIVE_ACTION_KEY, instance.sensitiveMethod);
    expect(sensitiveMetadata).toBe(true);

    const normalMetadata = Reflect.getMetadata(SENSITIVE_ACTION_KEY, instance.normalMethod);
    expect(normalMetadata).toBeUndefined();
  });

  it('should set ACTION_TYPE_KEY metadata when action is provided', () => {
    class TestController {
      @SensitiveAction('wallet_withdraw')
      withdraw() { return true; }
    }

    const instance = new TestController();
    const sensitiveMetadata = Reflect.getMetadata(SENSITIVE_ACTION_KEY, instance.withdraw);
    expect(sensitiveMetadata).toBe(true);

    const actionType = Reflect.getMetadata(ACTION_TYPE_KEY, instance.withdraw);
    expect(actionType).toBe('wallet_withdraw');
  });
});
