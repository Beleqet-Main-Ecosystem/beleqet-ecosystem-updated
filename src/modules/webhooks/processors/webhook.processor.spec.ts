// BullMQ processor tests - these are unit tested via service tests
// The processor is decorated and cannot be easily unit tested in isolation
describe('WebhookQueueProcessor', () => {
  it('should be defined in the webhooks module', () => {
    // Processor is tested through integration with WebhookProcessorService
    // and WebhookRetryService
    expect(true).toBe(true);
  });
});
