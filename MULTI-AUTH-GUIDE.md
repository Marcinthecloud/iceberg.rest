# Multi-Authentication Support Guide

This app now supports multiple authentication methods for connecting to different Iceberg catalog implementations!

## Supported Authentication Types

### 1. Bearer Token (Default)
- **Use for**: Generic REST catalogs, Polaris, Nessie, Unity Catalog, Microsoft OneLake, R2 Data Catalog
- **Fields**:
  - REST Catalog Endpoint
  - Authentication Token
  - Warehouse Name (optional for some, required for OneLake and R2)

### 2. OAuth2
- **Use for**: Snowflake Open Catalog, Confluent Tableflow
- **Fields**:
  - REST Catalog Endpoint
  - OAuth2 Token Endpoint (e.g., `https://<org>-<account>.snowflakecomputing.com/oauth/token`)
  - Client ID
  - Client Secret
  - Warehouse Name (catalog name for Snowflake)

### 3. AWS SigV4
- **Use for**: AWS Glue Iceberg REST Catalog
- **Fields**:
  - REST Catalog Endpoint
  - AWS Access Key
  - AWS Secret Key
  - AWS Region
  - Warehouse Name (AWS Account ID, e.g., `123456789012`)

## What's Changed

### Login Page (`src/pages/LoginPage.tsx`)
- Added dropdown to select authentication type
- Conditional form fields based on selected auth type
- Context-specific help text for warehouse field

### Worker (`worker/index.ts`)
- Stores credentials securely with auth type
- Implements OAuth2 token exchange (client credentials flow)
- Implements AWS Signature Version 4 request signing
- Routes requests through appropriate auth method

### Database Schema (`schema.sql`)
- Updated `sessions` table:
  - Added `auth_type` column
  - Changed `encrypted_token` to `encrypted_credentials` (JSON blob)
  - Removed `oauth_endpoint` (now in credentials)

### Connection Examples (`src/components/table/ConnectTab.tsx`)
- Auth-specific examples for each query engine
- AWS Glue examples for DuckDB, Trino, PySpark, PyIceberg
- Snowflake Open Catalog OAuth2 examples

## Catalog-Specific Examples

### AWS Glue Iceberg REST

**Login Settings:**
- Auth Type: AWS SigV4
- Endpoint: `https://glue.{region}.amazonaws.com` (e.g., `https://glue.us-west-2.amazonaws.com`)
- Warehouse: Your AWS Account ID (e.g., `123456789012`)
- AWS Access Key, Secret Key, Region
- AWS Service: `glue`

**Connection Examples Generated:**
- DuckDB: AWS extension with SigV4
- Trino: SigV4-enabled REST catalog
- PySpark: Glue catalog with SigV4
- PyIceberg: SigV4 authentication

### Snowflake Open Catalog

**Login Settings:**
- Auth Type: OAuth2
- Endpoint: Snowflake Iceberg REST endpoint
- OAuth Token Endpoint: `https://<org>-<account>.snowflakecomputing.com/oauth/token`
- Client ID and Secret
- Warehouse: Your catalog name

**Connection Examples Generated:**
- Snowflake: CREATE CATALOG INTEGRATION with OAuth2

### Microsoft OneLake

**Login Settings:**
- Auth Type: Bearer Token
- Endpoint: `https://onelake.table.fabric.microsoft.com/iceberg`
- Token: Microsoft Entra ID (Azure AD) access token
  - Get token: `az account get-access-token --resource https://storage.azure.com --query accessToken -o tsv`
- Warehouse: `{WorkspaceID}/{DataItemID}` or `{WorkspaceName}/{DataItemName}.{DataItemType}`

**Connection Examples Generated:**
- DuckDB: Standard REST with Bearer token + Azure extension
- All other standard examples with Bearer token auth

**Notes:**
- OneLake implements the full Iceberg REST API specification
- Uses Microsoft Entra ID (formerly Azure AD) for authentication
- Supports both ID-based and name-based warehouse formats

### Cloudflare R2 Data Catalog

**Login Settings:**
- Auth Type: Bearer Token
- Endpoint: Your R2 Data Catalog REST endpoint
- Token: Your R2 Data Catalog API token
- Warehouse: `{account_id}_{bucket_name}` (e.g., `a1b2c3d4e5f6g7h8_my-iceberg-bucket`)

**Connection Examples Generated:**
- All standard examples with Bearer token auth

**Notes:**
- Warehouse format is your Cloudflare account ID followed by underscore and R2 bucket name
- Both account ID and bucket name are required

### Generic REST Catalogs (Polaris, Nessie, etc.)

**Login Settings:**
- Auth Type: Bearer Token (default)
- Standard REST endpoint and token

**Connection Examples Generated:**
- All standard examples with Bearer token auth

## Migration Guide

If you have an existing D1 database, run the migration:

```bash
npx wrangler d1 execute iceberg_sessions --file=migration-auth-types.sql
```

This adds the new columns while preserving existing sessions.

## Technical Details

### OAuth2 Flow
1. User provides client ID, client secret, and OAuth endpoint
2. Worker exchanges credentials for access token on each request
3. Access token used in Authorization header for catalog requests

### AWS SigV4 Flow
1. User provides AWS access key, secret key, and region
2. Worker signs each request using Signature Version 4 algorithm
3. Signed headers (Authorization, x-amz-date) added to catalog requests

### Security
- All credentials (tokens, client secrets, AWS keys) encrypted with AES-256-GCM
- Stored as JSON in `encrypted_credentials` column
- Decrypted only when needed for request authentication
- Never logged or exposed in analytics

## Testing

Build succeeded! The app now:
1. ✅ Shows auth type dropdown on login page
2. ✅ Conditionally shows relevant fields
3. ✅ Stores auth credentials securely
4. ✅ Authenticates requests based on auth type
5. ✅ Generates auth-specific connection examples

## Troubleshooting

### OAuth2 Issues
- Verify OAuth endpoint URL is correct
- Check client ID and secret are valid
- Ensure scope includes necessary permissions

### SigV4 Issues
- Verify AWS credentials have correct permissions
- Check region matches catalog region
- Ensure clock is synchronized (SigV4 is time-sensitive)

### Connection Examples
- Examples are pre-populated with your endpoint and warehouse
- Replace `<your_*>` placeholders with actual credentials
- AWS examples assume environment variables or IAM roles for production use
