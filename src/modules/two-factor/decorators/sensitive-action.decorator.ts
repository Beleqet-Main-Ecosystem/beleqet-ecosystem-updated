import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const SENSITIVE_ACTION_KEY = 'sensitive_action';
export const ACTION_TYPE_KEY = 'action_type';

export const SensitiveAction = (action?: string): MethodDecorator => {
  return (target, key, descriptor) => {
    SetMetadata(SENSITIVE_ACTION_KEY, true)(target, key, descriptor);
    if (action) {
      SetMetadata(ACTION_TYPE_KEY, action)(target, key, descriptor);
    }
  };
};
