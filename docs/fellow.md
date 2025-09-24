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

The REST integration now attempts both the legacy `/api/v1/action-items`
endpoint, the newer `/v1/action-items` route, and their snake_case equivalents.
When the configured base URL points to the web application host (for example
`https://fellow.app`), the handler will automatically retry using the
`https://api.fellow.app` domain. If all REST candidates return `404`, the
integration falls back to the GraphQL endpoint (`/graphql`) using the same base
URL. If you continue to see `404` responses from the Fellow API, explicitly set
`FELLOW_API_BASE_URL=https://api.fellow.app` (or the equivalent API hostname
provided by your Fellow workspace) to skip the fallback.
