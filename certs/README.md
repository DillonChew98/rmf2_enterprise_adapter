# LIMS CA certificates

Drop the customer's **CA certificate** (PEM format) here when the LIMS SQL Server
uses an internal / corporate CA and you want verified TLS
(`MSSQL_TRUST_CERT=false`).

1. Copy the CA cert into this folder, e.g. `certs/lims-ca.pem`.
2. In `adapter.env` set:
   ```ini
   MSSQL_TRUST_CERT=false
   MSSQL_CA_CERT=/certs/lims-ca.pem
   ```
   (This folder is mounted read-only into the adapter container at `/certs`.)
3. Make sure `MSSQL_HOST` matches the hostname on the cert (its CN/SAN), or
   verification will fail.

Only the CA (public) cert is needed — never put private keys here. This folder is
git-ignored except for this README.
