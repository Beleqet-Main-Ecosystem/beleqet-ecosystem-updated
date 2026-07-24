import { Test, TestingModule } from '@nestjs/testing';
import { ComplexityPlugin } from './complexity.plugin';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { GraphQLSchema } from 'graphql';

// Mock the graphql-query-complexity module completely
jest.mock('graphql-query-complexity', () => ({
  getComplexity: jest.fn(),
  simpleEstimator: jest.fn(),
  fieldExtensionsEstimator: jest.fn(),
}));

import { getComplexity } from 'graphql-query-complexity';

describe('ComplexityPlugin', () => {
  let plugin: ComplexityPlugin;
  const mockSchemaHost = { schema: {} as GraphQLSchema };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplexityPlugin,
        { provide: GraphQLSchemaHost, useValue: mockSchemaHost },
      ],
    }).compile();

    plugin = module.get<ComplexityPlugin>(ComplexityPlugin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should immediately throw a GraphQLError if query complexity exceeds the 100 limit (DOS Prevention)', async () => {
    (getComplexity as jest.Mock).mockReturnValue(150); // Simulate an extremely deep/complex query
    
    const requestListener = await plugin.requestDidStart();
    
    await expect(
      requestListener.didResolveOperation!({
        request: { operationName: 'MaliciousQuery', variables: {} },
        document: {} as any,
      } as any)
    ).rejects.toThrow('Query is too complex: 150. Maximum allowed complexity: 100');
  });

  it('should pass transparently if query complexity is perfectly within normal limits', async () => {
    (getComplexity as jest.Mock).mockReturnValue(10); // Simulate standard UI query
    
    const requestListener = await plugin.requestDidStart();
    
    await expect(
      requestListener.didResolveOperation!({
        request: { operationName: 'StandardQuery', variables: {} },
        document: {} as any,
      } as any)
    ).resolves.toBeUndefined();
  });
});
