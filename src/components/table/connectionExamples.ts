// Helper function to detect if this is an Azure/OneLake catalog
export function isAzureCatalog(catalogUrl: string, metadataLocation?: string): boolean {
  const urlLower = catalogUrl.toLowerCase()
  const isAzureUrl = urlLower.includes('microsoft') ||
                     urlLower.includes('onelake') ||
                     urlLower.includes('fabric')

  const isAzureStorage = metadataLocation?.toLowerCase().includes('blob.fabric.microsoft.com') ||
                         metadataLocation?.toLowerCase().includes('dfs.fabric.microsoft.com') ||
                         metadataLocation?.toLowerCase().includes('.blob.core.windows.net')

  return isAzureUrl || !!isAzureStorage
}

export function getDuckDBExample(
  fullTable: string,
  catalogUrl: string,
  warehouseValue: string,
  authType: 'bearer' | 'oauth2' | 'sigv4',
  region: string,
  metadataLocation?: string
): { title: string; code: string; language: string } {
  // Check if this is an Azure/OneLake catalog
  if (isAzureCatalog(catalogUrl, metadataLocation)) {
    return {
      title: 'DuckDB SQL (Microsoft OneLake)',
      code: `-- Install required extensions
INSTALL iceberg;
LOAD iceberg;
INSTALL azure;
LOAD azure;
INSTALL httpfs;
LOAD httpfs;

-- Get Azure token (using Python with azure-identity package)
-- from azure.identity import DefaultAzureCredential
-- credential = DefaultAzureCredential()
-- token = credential.get_token("https://storage.azure.com/.default").token

-- Create secrets for OneLake catalog and storage
CREATE OR REPLACE SECRET onelake_catalog (
    TYPE ICEBERG,
    TOKEN '<your_azure_token>'
);

CREATE OR REPLACE SECRET onelake_storage (
    TYPE AZURE,
    PROVIDER ACCESS_TOKEN,
    ACCESS_TOKEN '<your_azure_token>',
    ACCOUNT_NAME 'onelake'
);

-- Attach OneLake catalog
ATTACH '${warehouseValue}' AS onelake (
    TYPE ICEBERG,
    SECRET onelake_catalog,
    ENDPOINT '${catalogUrl}'
);

-- Query the table
SELECT * FROM onelake.${fullTable};

-- Show all available tables
SHOW ALL TABLES;`,
      language: 'sql',
    }
  }

  if (authType === 'sigv4') {
    // AWS Glue example
    return {
      title: 'DuckDB SQL (AWS Glue)',
      code: `-- Install extensions
INSTALL iceberg;
LOAD iceberg;
INSTALL httpfs;
LOAD httpfs;
INSTALL aws;
LOAD aws;

-- Configure AWS credentials
CREATE SECRET (
    TYPE S3,
    KEY_ID '<your_aws_access_key>',
    SECRET '<your_aws_secret_key>',
    REGION '${region}'
);

-- Attach Glue catalog
ATTACH '${warehouseValue}' AS glue_catalog (
    TYPE ICEBERG,
    ENDPOINT '${catalogUrl}'
);

-- Query the table
SELECT * FROM glue_catalog.${fullTable};

-- Show all available tables
SHOW ALL TABLES;`,
      language: 'sql',
    }
  }

  // Bearer token (standard REST)
  return {
    title: 'DuckDB SQL',
    code: `-- Install the iceberg DuckDB extension (if you haven't already) and load the extension.
INSTALL iceberg;
LOAD iceberg;

-- Install and load httpfs extension for reading/writing files over HTTP(S).
INSTALL httpfs;
LOAD httpfs;

-- Create a DuckDB secret to store catalog credentials.
CREATE SECRET catalog_secret (
    TYPE ICEBERG,
    TOKEN '<your_api_token>'
);

-- Attach catalog with the following ATTACH statement.
ATTACH '${warehouseValue}' AS my_catalog (
    TYPE ICEBERG,
    ENDPOINT '${catalogUrl}'
);

-- Query the table
SELECT * FROM my_catalog.${fullTable};

-- Show all available tables
SHOW ALL TABLES;`,
    language: 'sql',
  }
}

export function getTrinoExample(
  fullTable: string,
  catalogUrl: string,
  warehouseValue: string,
  authType: 'bearer' | 'oauth2' | 'sigv4',
  region: string,
  metadataLocation?: string
): { title: string; code: string; language: string } {
  // Check if this is an Azure/OneLake catalog
  if (isAzureCatalog(catalogUrl, metadataLocation)) {
    return {
      title: 'Trino Catalog Properties (Microsoft OneLake)',
      code: `# Create a catalog properties file (e.g., /etc/trino/catalog/iceberg.properties)
connector.name=iceberg

# Storage Configuration
fs.native-azure.enabled=true
azure.auth-type=ACCESS_KEY
azure.storage-account=<your_storage_account_name>
azure.access-key=<your_storage_account_access_key>

# Data Catalog Configuration
iceberg.catalog.type=rest
iceberg.rest-catalog.uri=${catalogUrl}
iceberg.rest-catalog.warehouse=${warehouseValue}
iceberg.rest-catalog.security=OAUTH2
iceberg.rest-catalog.oauth2.token=<your_azure_token>

# Then query the table:
# SELECT * FROM iceberg.${fullTable};`,
      language: 'properties',
    }
  }

  if (authType === 'sigv4') {
    // AWS S3 Tables example
    return {
      title: 'Trino Catalog Properties (AWS S3 Tables)',
      code: `# Create a catalog properties file (e.g., /etc/trino/catalog/iceberg.properties)
connector.name=iceberg

# Storage Configuration
fs.native-s3.enabled=true
s3.region=${region}
s3.aws-access-key=<your_access_key>
s3.aws-secret-key=<your_secret_key>

# Data Catalog Configuration
iceberg.catalog.type=rest
iceberg.rest-catalog.uri=${catalogUrl}
iceberg.rest-catalog.warehouse=${warehouseValue}
iceberg.rest-catalog.sigv4.enabled=true
iceberg.rest-catalog.sigv4.region=${region}

# Then query the table:
# SELECT * FROM iceberg.${fullTable};`,
      language: 'properties',
    }
  }

  // Bearer token (standard REST)
  return {
    title: 'Trino Catalog Properties',
    code: `# Create a catalog properties file (e.g., /etc/trino/catalog/iceberg.properties)
connector.name=iceberg

# Storage Configuration
fs.native-s3.enabled=true
s3.region=auto
s3.aws-access-key=<your_access_key>
s3.aws-secret-key=<your_secret_key>
s3.endpoint=<your_s3_endpoint>
s3.path-style-access=true

# Data Catalog Configuration
iceberg.catalog.type=rest
iceberg.rest-catalog.uri=${catalogUrl}
iceberg.rest-catalog.warehouse=${warehouseValue}
iceberg.rest-catalog.security=OAUTH2
iceberg.rest-catalog.oauth2.token=<your_api_token>

# Then query the table:
# SELECT * FROM iceberg.${fullTable};`,
    language: 'properties',
  }
}

export function getSparkExample(
  fullTable: string,
  catalogUrl: string,
  warehouseValue: string,
  authType: 'bearer' | 'oauth2' | 'sigv4',
  region: string,
  metadataLocation?: string
): { title: string; code: string; language: string } {
  // Check if this is an Azure/OneLake catalog
  if (isAzureCatalog(catalogUrl, metadataLocation)) {
    return {
      title: 'PySpark Configuration (Microsoft OneLake)',
      code: `from pyspark.sql import SparkSession
from azure.identity import DefaultAzureCredential

# Get Azure credentials
credential = DefaultAzureCredential()
token = credential.get_token("https://storage.azure.com/.default").token

# Define catalog connection details
WAREHOUSE = "${warehouseValue}"
CATALOG_URI = "${catalogUrl}"

spark = SparkSession.builder \\
    .appName("OneLakeIcebergExample") \\
    .config('spark.jars.packages', 'org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:1.10.0') \\
    .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \\
    .config("spark.sql.catalog.onelake", "org.apache.iceberg.spark.SparkCatalog") \\
    .config("spark.sql.catalog.onelake.type", "rest") \\
    .config("spark.sql.catalog.onelake.uri", CATALOG_URI) \\
    .config("spark.sql.catalog.onelake.warehouse", WAREHOUSE) \\
    .config("spark.sql.catalog.onelake.token", token) \\
    .config("spark.sql.catalog.onelake.io-impl", "org.apache.iceberg.azure.adlsv2.ADLSFileIO") \\
    .config("spark.sql.catalog.onelake.adls.account-name", "onelake") \\
    .config("spark.sql.catalog.onelake.adls.account-host", "onelake.blob.fabric.microsoft.com") \\
    .config("spark.sql.catalog.onelake.adls.auth.shared-key.account.key", token) \\
    .config("spark.sql.defaultCatalog", "onelake") \\
    .getOrCreate()

spark.sql("USE onelake")

# Query the table
df = spark.table("${fullTable}")
df.show()`,
      language: 'python',
    }
  }

  if (authType === 'sigv4') {
    // AWS S3 Tables example
    return {
      title: 'PySpark Configuration (AWS S3 Tables)',
      code: `from pyspark.sql import SparkSession

# Define catalog connection details
WAREHOUSE = "${warehouseValue}"
CATALOG_URI = "${catalogUrl}"
AWS_REGION = "${region}"

spark = SparkSession.builder \\
    .appName("IcebergS3TablesExample") \\
    .config('spark.jars.packages', 'org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:1.7.1,software.amazon.s3tables:s3-tables-catalog:0.1.4') \\
    .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \\
    .config("spark.sql.catalog.my_catalog", "org.apache.iceberg.spark.SparkCatalog") \\
    .config("spark.sql.catalog.my_catalog.catalog-impl", "software.amazon.s3tables.iceberg.S3TablesCatalog") \\
    .config("spark.sql.catalog.my_catalog.warehouse", WAREHOUSE) \\
    .config("spark.sql.defaultCatalog", "my_catalog") \\
    .getOrCreate()

# Configure AWS credentials via environment variables or IAM role
# export AWS_ACCESS_KEY_ID=<your_access_key>
# export AWS_SECRET_ACCESS_KEY=<your_secret_key>

spark.sql("USE my_catalog")

# Query the table
df = spark.table("${fullTable}")
df.show()`,
      language: 'python',
    }
  }

  // Bearer token (standard REST)
  return {
    title: 'PySpark Configuration',
    code: `from pyspark.sql import SparkSession

# Define catalog connection details (replace variables)
WAREHOUSE = "${warehouseValue}"
TOKEN = "<your_api_token>"
CATALOG_URI = "${catalogUrl}"

spark = SparkSession.builder \\
    .appName("IcebergExample") \\
    .config('spark.jars.packages', 'org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:1.10.0,org.apache.iceberg:iceberg-aws-bundle:1.10.0') \\
    .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \\
    .config("spark.sql.catalog.my_catalog", "org.apache.iceberg.spark.SparkCatalog") \\
    .config("spark.sql.catalog.my_catalog.type", "rest") \\
    .config("spark.sql.catalog.my_catalog.uri", CATALOG_URI) \\
    .config("spark.sql.catalog.my_catalog.warehouse", WAREHOUSE) \\
    .config("spark.sql.catalog.my_catalog.token", TOKEN) \\
    .config("spark.sql.catalog.my_catalog.header.X-Iceberg-Access-Delegation", "vended-credentials") \\
    .config("spark.sql.catalog.my_catalog.s3.remote-signing-enabled", "false") \\
    .config("spark.sql.defaultCatalog", "my_catalog") \\
    .getOrCreate()

spark.sql("USE my_catalog")

# Query the table
df = spark.table("${fullTable}")
df.show()`,
    language: 'python',
  }
}

export function getPyIcebergExample(
  fullTable: string,
  catalogUrl: string,
  warehouseValue: string,
  authType: 'bearer' | 'oauth2' | 'sigv4',
  region: string,
  metadataLocation?: string
): { title: string; code: string; language: string } {
  // Check if this is an Azure/OneLake catalog
  if (isAzureCatalog(catalogUrl, metadataLocation)) {
    return {
      title: 'PyIceberg Python (Microsoft OneLake)',
      code: `from pyiceberg.catalog import load_catalog
from azure.identity import DefaultAzureCredential

# Define catalog connection details
table_api_url = "${catalogUrl}"
credential = DefaultAzureCredential()
token = credential.get_token("https://storage.azure.com/.default").token

# Parse warehouse (format: workspace_id/data_item_id)
warehouse = "${warehouseValue}"
account_name = "onelake"
account_host = f"{account_name}.blob.fabric.microsoft.com"

# Connect to OneLake catalog
catalog = load_catalog("onelake_catalog", **{
    "uri": table_api_url,
    "token": token,
    "warehouse": warehouse,
    "adls.account-name": account_name,
    "adls.account-host": account_host,
    "adls.credential": credential,
})

# Load the table
table = catalog.load_table("${fullTable}")

# Scan the table to pandas
df = table.scan().to_pandas()
print(df.head())

# Or scan to PyArrow
arrow_table = table.scan().to_arrow()
print(arrow_table)`,
      language: 'python',
    }
  }

  if (authType === 'sigv4') {
    // AWS Glue Iceberg REST example
    return {
      title: 'PyIceberg Python (AWS Glue)',
      code: `import pyarrow as pa
from pyiceberg.catalog.rest import RestCatalog

# Define catalog connection details
WAREHOUSE = "${warehouseValue}"
CATALOG_URI = "${catalogUrl}"
AWS_REGION = "${region}"

# Configure AWS credentials via environment variables or IAM role
# export AWS_ACCESS_KEY_ID=<your_access_key>
# export AWS_SECRET_ACCESS_KEY=<your_secret_key>

# Connect to catalog with SigV4 authentication
catalog = RestCatalog(
    name="my_catalog",
    warehouse=WAREHOUSE,
    uri=CATALOG_URI,
    sigv4=True,
    sigv4_region=AWS_REGION,
)

# Load the table
table = catalog.load_table("${fullTable}")

# Scan the table to pandas
df = table.scan().to_pandas()
print(df.head())

# Or scan to PyArrow
arrow_table = table.scan().to_arrow()
print(arrow_table)`,
      language: 'python',
    }
  }

  // Bearer token (standard REST)
  return {
    title: 'PyIceberg Python',
    code: `import pyarrow as pa
from pyiceberg.catalog.rest import RestCatalog
from pyiceberg.exceptions import NamespaceAlreadyExistsError

# Define catalog connection details (replace variables)
WAREHOUSE = "${warehouseValue}"
TOKEN = "<your_api_token>"
CATALOG_URI = "${catalogUrl}"

# Connect to catalog
catalog = RestCatalog(
    name="my_catalog",
    warehouse=WAREHOUSE,
    uri=CATALOG_URI,
    token=TOKEN,
)

# Load the table
table = catalog.load_table("${fullTable}")

# Scan the table to pandas
df = table.scan().to_pandas()
print(df.head())

# Or scan to PyArrow
arrow_table = table.scan().to_arrow()
print(arrow_table)`,
    language: 'python',
  }
}

export function getSnowflakeExample(
  fullTable: string,
  catalogUrl: string,
  warehouseValue: string,
  authType: 'bearer' | 'oauth2' | 'sigv4',
  metadataLocation?: string
): { title: string; code: string; language: string } {
  // Check if this is an Azure/OneLake catalog
  if (isAzureCatalog(catalogUrl, metadataLocation)) {
    return {
      title: 'Snowflake SQL (Microsoft OneLake)',
      code: `-- Create catalog integration for OneLake
CREATE OR REPLACE CATALOG INTEGRATION onelake_catalog
  CATALOG_SOURCE = ICEBERG_REST
  TABLE_FORMAT = ICEBERG
  REST_CONFIG = (
    CATALOG_URI = '${catalogUrl}'
    CATALOG_NAME = '${warehouseValue}'
  )
  REST_AUTHENTICATION = (
    TYPE = OAUTH
    OAUTH_TOKEN_URI = 'https://login.microsoftonline.com/<your_tenant_id>/oauth2/v2.0/token'
    OAUTH_CLIENT_ID = '<your_client_id>'
    OAUTH_CLIENT_SECRET = '<your_client_secret>'
    OAUTH_ALLOWED_SCOPES = ('https://storage.azure.com/.default')
  )
  ENABLED = TRUE;

-- Create external volume for OneLake storage
CREATE OR REPLACE EXTERNAL VOLUME onelake_exvol
  STORAGE_LOCATIONS = ((
    NAME = 'onelake_exvol'
    STORAGE_PROVIDER = 'AZURE'
    STORAGE_BASE_URL = 'azure://onelake.dfs.fabric.microsoft.com/${warehouseValue}'
    AZURE_TENANT_ID='<your_tenant_id>'
  ))
  ALLOW_WRITES = FALSE;

-- Create catalog-linked database
CREATE OR REPLACE DATABASE onelake_db
  LINKED_CATALOG = (CATALOG = 'onelake_catalog')
  EXTERNAL_VOLUME = 'onelake_exvol';

-- Query the table
SELECT * FROM onelake_db.${fullTable};`,
      language: 'sql',
    }
  }

  if (authType === 'oauth2') {
    return {
      title: 'Snowflake SQL (Open Catalog OAuth2)',
      code: `-- Create catalog integration for Snowflake Open Catalog using OAuth2
CREATE OR REPLACE CATALOG INTEGRATION my_rest_catalog
  CATALOG_SOURCE = ICEBERG_REST
  TABLE_FORMAT = ICEBERG
  REST_CONFIG = (
    CATALOG_URI = '${catalogUrl}'
    CATALOG_NAME = '${warehouseValue}'
    ACCESS_DELEGATION_MODE = VENDED_CREDENTIALS
  )
  REST_AUTHENTICATION = (
    TYPE = OAUTH
    OAUTH_CLIENT_ID = '<your_client_id>'
    OAUTH_CLIENT_SECRET = '<your_client_secret>'
    OAUTH_TOKEN_ENDPOINT = '<your_oauth_endpoint>'
  )
  ENABLED = TRUE;

-- Query the table using the catalog integration
SELECT * FROM my_rest_catalog.${fullTable};`,
      language: 'sql',
    }
  }

  // Bearer token (standard REST)
  return {
    title: 'Snowflake SQL',
    code: `-- Create catalog integration for Iceberg REST
CREATE OR REPLACE CATALOG INTEGRATION my_rest_catalog
  CATALOG_SOURCE = ICEBERG_REST
  TABLE_FORMAT = ICEBERG
  REST_CONFIG = (
    CATALOG_URI = '${catalogUrl}'
    CATALOG_NAME = '${warehouseValue}'
    ACCESS_DELEGATION_MODE = VENDED_CREDENTIALS
  )
  REST_AUTHENTICATION = (
    TYPE = BEARER
    BEARER_TOKEN = '<your_api_token>'
  )
  ENABLED = TRUE;

-- Query the table using the catalog integration
SELECT * FROM my_rest_catalog.${fullTable};`,
    language: 'sql',
  }
}
