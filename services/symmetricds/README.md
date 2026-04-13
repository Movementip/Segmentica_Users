# SymmetricDS container

This folder contains the local SymmetricDS 3.16.8 distribution used by Docker.

The image starts `bin/sym` and patches the selected engine properties from environment variables at container startup. By default it uses the existing `node-mac` engine.

Important environment variables:

- `SYMMETRIC_ENGINE_NAME`: engine file name without `.properties`, default `node-mac`.
- `SYMMETRIC_DB_URL`: JDBC URL for SymmetricDS.
- `SYMMETRIC_DB_USER` and `SYMMETRIC_DB_PASSWORD`: database credentials.
- `SYMMETRIC_PUBLIC_URL`: public base URL for this node, for example `http://static-ip:31415`.
- `SYMMETRIC_REGISTRATION_URL`: parent registration URL.

When PostgreSQL is running on the Mac host, use `host.docker.internal` in `SYMMETRIC_DB_URL` instead of `localhost`.
