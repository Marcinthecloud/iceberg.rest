# Building with Claude Code

This project was built entirely using [Claude Code](https://claude.com/claude-code), Anthropic's agentic coding tool. This document serves as both guidance for Claude Code when working on this codebase and as a guide for developers who want to build similar applications.

## What is iceberg.rest?

iceberg.rest is a web application for exploring Apache Iceberg REST catalogs. It provides a clean, modern interface for browsing catalog metadata, viewing table schemas, analyzing snapshots, and generating connection code for popular query engines.

### Key Features
- Multi-authentication support (Bearer Token, OAuth2, AWS SigV4)
- Catalog and namespace browsing
- Table metadata viewer with schema evolution
- Snapshot history with 7-day activity charts
- Connection code generation (DuckDB, Trino, Spark, PyIceberg, Snowflake)
- Secure credential storage with AES-256-GCM encryption
- Analytics and usage tracking

## Project Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS for utility-first styling
- **Backend**: Cloudflare Workers (serverless compute)
- **Database**: Cloudflare D1 (SQLite for sessions and analytics)
- **Storage**: Cloudflare KV (encrypted credential storage)
- **Encryption**: Web Crypto API (AES-256-GCM)

### Why This Stack?
1. **Serverless-first**: No servers to manage, scales automatically
2. **Edge deployment**: Fast global response times via Cloudflare's network
3. **Type-safe**: TypeScript catches errors at compile time
4. **Modern tooling**: Vite provides instant HMR and optimized builds
5. **Cost-effective**: Cloudflare's generous free tier

## How We Built This with Claude Code

### Phase 1: Initial Setup (30 minutes)
**Prompt**: *"Help me build a web app to explore Apache Iceberg REST catalogs. Use React, TypeScript, Vite, and Tailwind CSS. It should be deployed on Cloudflare Workers."*

Claude Code set up:
- Vite + React + TypeScript project structure
- Tailwind CSS configuration
- Cloudflare Workers integration with wrangler.toml
- Basic routing with React Router
- Initial component structure

### Phase 2: Core Features (2-3 hours)
**Approach**: Iterative development with specific, actionable prompts

Example prompts:
- *"Create a login page with fields for REST endpoint, auth type selector, and token"*
- *"Build a catalog browser showing namespaces in a hierarchical tree view"*
- *"Add a table detail page with tabs for Schema, Snapshots, Partitions, Properties, and Connect"*
- *"Implement schema evolution viewer with visual diff highlighting (green=added, red=removed, orange=modified)"*

**Key Learning**: Be specific about UI/UX requirements. Share examples or mockups.

### Phase 3: Multi-Authentication Support (2-3 hours)
**Challenge**: Support multiple Iceberg catalog types (AWS Glue, Snowflake, OneLake, R2, etc.)

**Prompt**: *"Add support for AWS SigV4 authentication for AWS Glue. The canonical request must have headers sorted alphabetically."*

Claude Code implemented:
- AWS Signature Version 4 signing algorithm
- OAuth2 client credentials flow
- Dynamic UI that shows/hides fields based on auth type
- Auth-specific connection examples for each query engine
- Secure credential storage with different formats per auth type

**Key Insight**: Claude Code can implement complex authentication protocols when given official documentation links and clear success criteria.

### Phase 4: Connection Examples (1 hour)
**Prompt**: *"Generate copy-paste connection code for DuckDB, Trino, Spark, PyIceberg, and Snowflake. Make them dynamic with the user's endpoint and warehouse pre-filled."*

Claude Code created:
- Template system for each query engine
- Auth-specific variations (Bearer vs OAuth2 vs SigV4)
- Syntax highlighting with proper language detection
- One-click copy functionality

### Phase 5: Polish & Production (1-2 hours)
**Prompts**:
- *"Add a modal explaining warehouse parameter formats for different catalogs (OneLake, R2, Snowflake, etc.)"*
- *"Create a security and privacy modal explaining encryption and data handling"*
- *"Add analytics tracking for page views and feature usage (no PII)"*
- *"Implement 7-day snapshot activity chart"*

## Tips for Building with Claude Code

### 1. Start with Clear Goals
Define your project vision upfront:
```
I want to build a [type of app] that does [core functionality].
Target users are [audience] who need to [primary use case].
Tech stack: [framework], [styling], [deployment platform].
```

### 2. Provide Context
Share relevant resources:
- API specifications (e.g., Iceberg REST OpenAPI spec)
- Authentication documentation
- Design inspiration (screenshots, Figma links)
- Similar projects for reference

### 3. Iterate in Layers
Build complexity gradually:
1. **Foundation**: Basic UI structure and routing
2. **Core Features**: Main functionality without auth
3. **Authentication**: Add security layer
4. **Advanced Features**: Analytics, visualizations
5. **Polish**: Error handling, loading states, help modals

### 4. Be Specific About UX
❌ Bad: *"Create a modal for catalog info"*
✅ Good: *"Create a modal similar to the Features modal, with sections for each catalog type. Each section should show the warehouse format in a code block, concrete examples, and helpful notes."*

### 5. Debug Together
When something breaks:
1. Share the exact error message
2. Describe expected vs. actual behavior
3. Let Claude Code read relevant files
4. Test fixes iteratively

### 6. Ask for Explanations
Don't hesitate to ask:
- *"Why did you implement it this way?"*
- *"What are the security implications?"*
- *"Can you explain how this algorithm works?"*

## Design Principles

The UI follows these principles:
- **Clean and Modern**: Minimal clutter, ample whitespace
- **Fast and Responsive**: Instant feedback, optimistic UI updates
- **Secure by Default**: Credentials encrypted, read-only access, no PII
- **Informative**: Clear help text, examples, and error messages
- **Accessible**: Semantic HTML, keyboard navigation, ARIA labels 


## Development Workflow

### Setup
```bash
# Clone and install
git clone <your-repo>
cd iceberg.rest
npm install

# Authenticate with Cloudflare
npx wrangler login
```

### Local Development
```bash
# Terminal 1: Run Cloudflare Worker (handles API proxying)
npx wrangler dev --port 8787

# Terminal 2: Run Vite dev server
npm run dev

# Visit http://localhost:5173
```

### Production Deployment
```bash
# Build and deploy
npm run build
npx wrangler deploy

# Run database migrations
npx wrangler d1 execute iceberg_sessions --remote --file=schema.sql
```

## Project Structure

```
/src
  /components
    /auth         - Login form, authentication components
    /catalog      - Catalog browser, namespace tree view
    /table        - Table tabs (Schema, Snapshots, Partitions, Properties, Connect)
    /layout       - Sidebar, navigation, header
    /ui           - Reusable components (Button, Input, Card, Badge, etc.)
  /lib
    /iceberg      - Iceberg REST API client
    /crypto       - Token encryption (AES-256-GCM)
    /utils        - Utility functions
  /types          - TypeScript type definitions
  /pages          - Route components (Login, Catalog, Table pages)

/worker
  index.ts        - Cloudflare Worker (handles auth, proxying, analytics)
```

## Key Implementation Details

### Multi-Authentication System
The app supports three auth types:
1. **Bearer Token**: Standard REST catalogs (R2, Unity Catalog, OneLake, Polaris, Nessie)
2. **OAuth2**: Snowflake Open Catalog, Confluent Tableflow
3. **AWS SigV4**: AWS Glue Data Catalog

Each auth type stores credentials differently in an encrypted JSON blob.

### Schema Evolution Viewer
Compares schema versions and highlights changes:
- 🟢 Green: New fields added
- 🔴 Red: Fields removed
- 🟠 Orange: Fields modified (type changes)

### Connection Code Generation
Generates pre-filled connection code for:
- DuckDB SQL
- Trino properties
- PySpark configuration
- PyIceberg Python
- Snowflake SQL

Examples are customized based on:
- Auth type (Bearer, OAuth2, SigV4)
- Endpoint and warehouse values
- Catalog-specific requirements

### Security Implementation
- **Encryption**: AES-256-GCM via Web Crypto API
- **Key Storage**: Encryption keys in Cloudflare KV
- **Session Management**: 24-hour TTL, automatic cleanup
- **Analytics**: No PII, only aggregated metrics

## Lessons Learned

### What Worked Well
1. **Iterative Development**: Building one feature at a time
2. **Type Safety**: TypeScript caught many bugs early
3. **Clear Prompts**: Specific requirements yielded better results
4. **Documentation**: Sharing API specs helped Claude Code understand context

### What Could Be Improved
1. **Testing**: Add unit tests from the beginning
2. **State Management**: Consider Redux/Zustand for complex state
3. **Error Boundaries**: More granular error handling
4. **Performance**: Add virtual scrolling for large lists

## Resources

- [Apache Iceberg REST API Spec](https://github.com/apache/iceberg/blob/main/open-api/rest-catalog-open-api.yaml)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Claude Code Documentation](https://docs.claude.com/claude-code)

## Contributing

Use this project as a reference for building with Claude Code. The patterns and approaches here can be adapted for other API-driven web applications.

---

**Built with ❤️ using [Claude Code](https://claude.com/claude-code)**
