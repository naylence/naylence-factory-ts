import { 
  createResource, 
  createDefaultResource, 
  registerFactory,
  ExpressionEvaluationPolicy,
  configValidator
} from '../index';
import { AbstractResourceFactory } from '../factory';
import type { ResourceConfig } from '../resource-config';

// Example JWT Authorizer implementation to mirror Python tests
interface JwtAuthorizerResource {
  issuer: string;
  audience: string;
  requiredScopes: string;
}

interface JwtAuthorizerConfig extends ResourceConfig {
  type: 'JwtAuthorizer';
  issuer: string;
  audience: string;
  requiredScopes: string;
}

class JwtAuthorizerFactory extends AbstractResourceFactory<JwtAuthorizerResource, JwtAuthorizerConfig> {
  public readonly type = 'JwtAuthorizer';
  public readonly isDefault = true;
  public readonly priority = 10;

  public async create(config?: JwtAuthorizerConfig): Promise<JwtAuthorizerResource> {
    if (!config) {
      throw new Error('JwtAuthorizer requires configuration');
    }

    return {
      issuer: config.issuer,
      audience: config.audience,
      requiredScopes: config.requiredScopes,
    };
  }
}

describe('Integration Tests - Expression Evaluation', () => {
  beforeAll(() => {
    // Register the JWT Authorizer factory
    registerFactory('AuthorizerFactory', 'JwtAuthorizer', JwtAuthorizerFactory);
    
    // Register schema for validation
    configValidator.registerSchema({
      type: 'JwtAuthorizer',
      properties: {
        type: { type: 'string', required: true },
        issuer: { type: 'string', required: true },
        audience: { type: 'string', required: true },
        requiredScopes: { type: 'string', required: true },
      },
    });
  });

  beforeEach(() => {
    // Clear any global process mock
    delete (globalThis as any).process;
  });

  it('should evaluate expressions in resource configuration', async () => {
    // Set up environment variables for testing (simulate Node.js environment)
    (globalThis as any).process = {
      env: {
        'AUTH_ISSUER': 'https://auth.prod.example.com',
        'AUTH_AUD': 'naylence-production',
        // Note: AUTH_SCOPES is not set, so default will be used
      }
    };

    const configData = {
      type: 'JwtAuthorizer',
      issuer: '${env:AUTH_ISSUER:https://auth.dev.local}',
      audience: '${env:AUTH_AUD:naylence-node}',
      requiredScopes: '${env:AUTH_SCOPES:fabric.read fabric.write}',
    };

    // Test EVALUATE policy (default)
    const resource = await createResource<JwtAuthorizerResource>(
      'AuthorizerFactory',
      configData,
      { 
        policy: ExpressionEvaluationPolicy.EVALUATE,
        validate: true 
      }
    );

    expect(resource).toBeDefined();
    expect(resource!.issuer).toBe('https://auth.prod.example.com');
    expect(resource!.audience).toBe('naylence-production');
    expect(resource!.requiredScopes).toBe('fabric.read fabric.write'); // default value used
  });

  it('should handle LITERAL policy', async () => {
    const configData = {
      type: 'JwtAuthorizer',
      issuer: '${env:AUTH_ISSUER:https://auth.dev.local}',
      audience: '${env:AUTH_AUD:naylence-node}',
      requiredScopes: '${env:AUTH_SCOPES:fabric.read fabric.write}',
    };

    // Test LITERAL policy
    const resource = await createResource<JwtAuthorizerResource>(
      'AuthorizerFactory',
      configData,
      { 
        policy: ExpressionEvaluationPolicy.LITERAL,
        validate: true 
      }
    );

    expect(resource).toBeDefined();
    expect(resource!.issuer).toBe('${env:AUTH_ISSUER:https://auth.dev.local}');
    expect(resource!.audience).toBe('${env:AUTH_AUD:naylence-node}');
    expect(resource!.requiredScopes).toBe('${env:AUTH_SCOPES:fabric.read fabric.write}');
  });

  it('should handle ERROR policy', async () => {
    // Set up mock environment first
    (globalThis as any).process = {
      env: {}
    };

    const configData = {
      type: 'JwtAuthorizer',
      issuer: '${env:AUTH_ISSUER:https://auth.dev.local}',
      audience: '${env:AUTH_AUD:naylence-node}',
      requiredScopes: '${env:AUTH_SCOPES:fabric.read fabric.write}',
    };

    // Test ERROR policy - should throw
    try {
      await createResource<JwtAuthorizerResource>(
        'AuthorizerFactory',
        configData,
        { 
          policy: ExpressionEvaluationPolicy.ERROR,
          validate: true 
        }
      );
      // If we get here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain('Expression found but evaluation is not allowed');
    } finally {
      // Clean up
      delete (globalThis as any).process;
    }
  });

  it('should handle custom environment context', async () => {
    const configData = {
      type: 'JwtAuthorizer',
      issuer: '${env:CUSTOM_ISSUER}',
      audience: '${env:CUSTOM_AUD:default-audience}',
      requiredScopes: '${env:CUSTOM_SCOPES:read write}',
    };

    // Provide custom environment via context
    const resource = await createResource<JwtAuthorizerResource>(
      'AuthorizerFactory',
      configData,
      {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: {
          'CUSTOM_ISSUER': 'https://custom.auth.example.com',
          'CUSTOM_AUD': 'custom-audience',
          // CUSTOM_SCOPES not provided, will use default
        },
        validate: true
      }
    );

    expect(resource).toBeDefined();
    expect(resource!.issuer).toBe('https://custom.auth.example.com');
    expect(resource!.audience).toBe('custom-audience');
    expect(resource!.requiredScopes).toBe('read write'); // default value
  });

  it('should handle config expressions', async () => {
    const configData = {
      type: 'JwtAuthorizer',
      issuer: '${config:auth.issuer:https://default.auth.com}',
      audience: '${config:auth.audience}',
      requiredScopes: '${env:SCOPES:default.read default.write}',
    };

    const resource = await createResource<JwtAuthorizerResource>(
      'AuthorizerFactory',
      configData,
      {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        config: {
          auth: {
            issuer: 'https://config.auth.example.com',
            audience: 'config-audience'
          }
        },
        validate: true
      }
    );

    expect(resource).toBeDefined();
    expect(resource!.issuer).toBe('https://config.auth.example.com');
    expect(resource!.audience).toBe('config-audience');
    expect(resource!.requiredScopes).toBe('default.read default.write'); // env default
  });

  it('should work with createDefaultResource', async () => {
    // Set up environment
    (globalThis as any).process = {
      env: {
        'DEFAULT_ISSUER': 'https://default.auth.com',
        'DEFAULT_AUD': 'default-audience'
      }
    };

    // Create using default factory (no type specified)
    const resource = await createDefaultResource<JwtAuthorizerResource>(
      'AuthorizerFactory',
      {
        issuer: '${env:DEFAULT_ISSUER}',
        audience: '${env:DEFAULT_AUD}',
        requiredScopes: 'default.read default.write',
      },
      { validate: true }
    );

    expect(resource).toBeDefined();
    expect(resource!.issuer).toBe('https://default.auth.com');
    expect(resource!.audience).toBe('default-audience');
    expect(resource!.requiredScopes).toBe('default.read default.write');
  });

  it('should handle mixed expressions in single field', async () => {
    const configData = {
      type: 'JwtAuthorizer',
      issuer: 'https://${env:AUTH_HOST:auth.example.com}:${env:AUTH_PORT:443}',
      audience: '${env:APP_NAME:myapp}-${env:ENVIRONMENT:production}',
      requiredScopes: 'read write admin',
    };

    const resource = await createResource<JwtAuthorizerResource>(
      'AuthorizerFactory',
      configData,
      {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: {
          'AUTH_HOST': 'secure.auth.com',
          'AUTH_PORT': '8443',
          'APP_NAME': 'testapp',
          'ENVIRONMENT': 'staging'
        },
        validate: true
      }
    );

    expect(resource).toBeDefined();
    expect(resource!.issuer).toBe('https://secure.auth.com:8443');
    expect(resource!.audience).toBe('testapp-staging');
    expect(resource!.requiredScopes).toBe('read write admin');
  });

  it('should handle validation errors gracefully', async () => {
    const configData = {
      type: 'JwtAuthorizer',
      // Missing required fields
      issuer: '${env:MISSING_ISSUER}', // This will fail because no default and var doesn't exist
    };

    await expect(
      createResource<JwtAuthorizerResource>(
        'AuthorizerFactory',
        configData,
        { 
          policy: ExpressionEvaluationPolicy.EVALUATE,
          env: {}, // Empty environment
          validate: true 
        }
      )
    ).rejects.toThrow(/Configuration validation failed/);
  });
});