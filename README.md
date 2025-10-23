# Naylence factory

**Naylence factory** is the resource factory and extension management framework for the [Naylence](https://github.com/naylence) ecosystem, implemented in TypeScript.
It provides a structured way to define, register, and instantiate resources (connectors, stores, clients, etc.) using schema-driven configuration, priority-based defaults, and plugin-style extension loading.

---

## Features

* 🏭 **Resource Factories** — Define factories that build typed resources from configs.
* 🔌 **Extension Management** — Discover and register implementations through lightweight plugins.
* ⚡ **Priority-based Defaults** — Automatically select the “best” default implementation.
* 🧩 **Composable Configs** — Type-safe configs with expression support (`${env:VAR:default}`).
* 🔒 **Policy-driven Evaluation** — Control how config expressions are handled: evaluate, literal, or error.
* 🔄 **Polymorphic Dispatch** — Automatically instantiate subclasses based on `type` fields.

---

## Installation

```bash
npm install @naylence/factory
```

Requires **Node.js 18+** or modern browsers with ES2022 support.

---
## License

Apache 2.0 © Naylence Dev