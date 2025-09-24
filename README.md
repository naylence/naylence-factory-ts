# Naylence Factory TypeScript

**Naylence Factory TypeScript** is the resource factory and extension management framework for the [Naylence](https://github.com/naylence) ecosystem, ported from Python to TypeScript.

It provides a structured way to define, register, and instantiate resources (connectors, stores, clients, etc.) using configuration validation, priority-based defaults, and explicit extension registration.

---

## Features

* 🏭 **Resource Factories** — Define factories that build typed resources from configs
* 🔌 **Extension Management** — Register and discover implementations via explicit registration (replaces Python entry points)
* ⚡ **Priority-based Defaults** — Automatically select the "best" default implementation
* 🧩 **Composable Configs** — Configuration with expression support (`${env:VAR:default}`)
* 🔒 **Policy-driven Evaluation** — Control how config expressions are handled: evaluate, literal, or error
* 🔄 **Polymorphic Dispatch** — Automatically instantiate subclasses based on `type` fields
* 🌐 **Universal Support** — Works in both Node.js and browser environments

---

## Installation

```bash
npm install naylence-factory
```

Requires **Node.js 16+** or modern browsers with ES2020 support.

### Optional Dependencies

For configuration validation (recommended):
```bash
npm install zod  # Alternative validation library (optional)
```

---

## Quick Start

### 1. Define a Resource Factory

```typescript
import { AbstractResourceFactory, ResourceConfig } from 'naylence-factory';

// Define your resource type
interface DatabaseConnection {
  host: string;
  port: number;
  connect(): Promise<void>;
}

// Define configuration schema
interface DatabaseConfig extends ResourceConfig {
  type: 'PostgresConnector';
  host: string;
  port: number;
  database: string;
}

// Implement the factory
class PostgresConnectorFactory extends AbstractResourceFactory<DatabaseConnection, DatabaseConfig> {
  public readonly type = 'PostgresConnector';
  public readonly isDefault = true;
  public readonly priority = 10;

  public async create(config: DatabaseConfig): Promise<DatabaseConnection> {
    return {
      host: config.host,
      port: config.port,
      async connect() {
        console.log(`Connecting to ${config.host}:${config.port}/${config.database}`);
      }
    };
  }
}
```

### 2. Register and Use Factories

```typescript
import { registerFactory, createResource, Expressions } from 'naylence-factory';

// Register the factory
registerFactory('ConnectorFactory', 'PostgresConnector', PostgresConnectorFactory);

// Create resources using configuration
const config = {
  type: 'PostgresConnector',
  host: Expressions.env('DB_HOST', 'localhost'),
  port: Expressions.env('DB_PORT', '5432'),
  database: 'myapp'
};

const connection = await createResource<DatabaseConnection>('ConnectorFactory', config);
await connection.connect();
```

### 3. Expression Support

```typescript
import { Expressions, ExpressionEvaluationPolicy } from 'naylence-factory';

const config = {
  type: 'ApiClient',
  baseUrl: Expressions.env('API_URL', 'https://api.example.com'),
  timeout: Expressions.env('API_TIMEOUT', '30000'),
  apiKey: Expressions.env('API_KEY'), // Required, no default
};

// Create with custom environment
const client = await createResource('ClientFactory', config, {
  policy: ExpressionEvaluationPolicy.EVALUATE,
  env: {
    'API_URL': 'https://staging.api.example.com',
    'API_TIMEOUT': '60000',
    'API_KEY': 'sk-test-123'
  }
});
```

---

## Key Differences from Python Version

### Extension Registration

**Python (entry points):**
```python
# setup.py / pyproject.toml
[project.entry-points."naylence.ConnectorFactory"]
postgres = "mypackage:PostgresConnectorFactory"
```

**TypeScript (explicit registration):**
```typescript
import { registerFactory } from 'naylence-factory';
import { PostgresConnectorFactory } from './postgres-factory';

registerFactory('ConnectorFactory', 'PostgresConnector', PostgresConnectorFactory);
```

### Configuration Validation

**Python (Pydantic):**
```python
class DatabaseConfig(ResourceConfig):
    host: str
    port: int = 5432
    database: str
```

**TypeScript (Built-in validator):**
```typescript
import { configValidator } from 'naylence-factory';

configValidator.registerSchema({
  type: 'PostgresConnector',
  properties: {
    type: { type: 'string', required: true },
    host: { type: 'string', required: true },
    port: { type: 'number', defaultValue: 5432 },
    database: { type: 'string', required: true },
  },
});
```

### Environment Access

**Python:**
```python
# Automatic access to os.environ
config = {"host": "${env:DB_HOST:localhost}"}
```

**TypeScript:**
```typescript
// Node.js: Automatic access to process.env
// Browser: Must provide via context
const config = { host: "${env:DB_HOST:localhost}" };

// Or provide custom environment:
await createResource('ConnectorFactory', config, {
  env: { 'DB_HOST': 'custom.host.com' }
});
```

---

## API Reference

### Core Classes

- **`ResourceFactory<T, C>`** — Generic factory interface
- **`AbstractResourceFactory<T, C>`** — Base factory implementation
- **`ExtensionManager<T, C>`** — Manages factory registration and discovery
- **`ResourceFactoryRegistry`** — Central registry for resource creation

### Configuration & Validation

- **`ResourceConfig`** — Base interface for resource configurations
- **`ResourceConfigValidator`** — Validates and processes configurations
- **`configValidator`** — Global validator instance

### Expression System

- **`ExpressionEvaluator`** — Evaluates `${env:VAR:default}` expressions
- **`Expressions`** — Utility for creating expressions
- **`ExpressionEvaluationPolicy`** — Controls evaluation behavior

### Main Functions

- **`createResource<T>(baseType, config, options?)`** — Create resource from config
- **`createDefaultResource<T>(baseType, config?, options?)`** — Use default factory
- **`registerFactory(baseType, resourceType, constructor, metadata?)`** — Register factory

---

## Advanced Usage

### Custom Validation

```typescript
import { ResourceConfigValidator } from 'naylence-factory';

const customValidator = new ResourceConfigValidator();

customValidator.registerSchema({
  type: 'ApiClient',
  properties: {
    type: { type: 'string', required: true },
    baseUrl: { 
      type: 'string', 
      required: true,
      validator: (value) => {
        if (typeof value === 'string' && value.startsWith('https://')) {
          return true;
        }
        return 'Base URL must start with https://';
      }
    },
    timeout: { type: 'number', defaultValue: 30000 },
  },
});
```

### Priority-based Defaults

```typescript
// Register multiple implementations with different priorities
registerFactory('StorageFactory', 'S3Storage', S3StorageFactory, {
  isDefault: true,
  priority: 20, // Higher priority
  description: 'AWS S3 storage implementation'
});

registerFactory('StorageFactory', 'LocalStorage', LocalStorageFactory, {
  isDefault: true,
  priority: 10, // Lower priority
  description: 'Local filesystem storage'
});

// S3Storage will be selected as the default due to higher priority
const storage = await createDefaultResource('StorageFactory');
```

### Browser vs Node.js

```typescript
// Node.js - automatic process.env access
const nodeConfig = {
  type: 'DatabaseConnector',
  host: '${env:DB_HOST:localhost}' // Uses process.env.DB_HOST
};

// Browser - provide environment via context
const browserConfig = {
  type: 'ApiConnector',  
  apiKey: '${env:API_KEY}'
};

const apiClient = await createResource('ConnectorFactory', browserConfig, {
  env: {
    'API_KEY': getUserApiKey() // Custom environment provider
  }
});
```

---

## Browser Support

The library includes separate builds for different environments:

### ES Modules (Recommended)
```html
<script type="module">
import { createResource, Expressions } from './node_modules/naylence-factory/dist/browser/index.esm.js';
</script>
```

### UMD (Global)
```html
<script src="./node_modules/naylence-factory/dist/browser/index.js"></script>
<script>
const { createResource, Expressions } = NaylenceFactory;
</script>
```

---

## Migration from Python

If you're migrating from the Python version:

1. **Replace entry points** with explicit `registerFactory()` calls
2. **Replace Pydantic models** with `configValidator.registerSchema()` 
3. **Update imports** to use the TypeScript package
4. **Handle environment** differences between Node.js and browser
5. **Update tests** to use Jest instead of pytest

See the [Migration Guide](./MIGRATION.md) for detailed examples.

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build all targets
npm run build

# Development mode
npm run dev
```

---

## License

Apache 2.0 © Naylence Dev