# Fellow Integration Configuration

The Fellow task sync relies on the following environment variables:

- `FELLOW_API_TOKEN` – required authentication token used for all requests.
- `FELLOW_API_BASE_URL` – optional base URL for the Fellow API. Defaults to
  `https://fellow.app` when unset. The value can be provided with or without a
  scheme, and any trailing slashes will be trimmed before requests are made.
  The handler automatically builds GraphQL (`/graphql`) and REST paths (for
  example `/api/v1/...`) on top of this normalized base URL.
- `FELLOW_ACTIONS_LIMIT` – optional cap for the number of items fetched per request (defaults to `100`, maximum `200`).

> **Migration note:** the previous `FELLOW_GRAPHQL_ENDPOINT` configuration is
> still read for backwards compatibility, but it is now treated as a base URL.
> Please migrate to `FELLOW_API_BASE_URL` to avoid confusion and to take
> advantage of the new REST endpoint support.
