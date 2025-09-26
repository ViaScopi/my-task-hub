# Trello Integration Configuration

The Trello sync relies on the following environment variables:

- `TRELLO_API_KEY` – required API key from Trello.
- `TRELLO_TOKEN` – required Trello API token that has access to the boards you want to sync.
- `TRELLO_MEMBER_ID` – required Trello member identifier (either the member ID or username) whose
  assigned cards will be fetched.
- `TRELLO_BOARD_IDS` – optional comma-separated list of Trello board IDs to include. When unset all
  open cards assigned to the configured member are returned.
- `TRELLO_EXCLUDED_BOARD_IDS` – optional comma-separated list of board IDs to ignore. These boards
  are filtered out even when they appear in the allow list above or when no allow list is provided.
- `TRELLO_FELLOW_BOARD_IDS` – optional comma-separated list of board IDs that should power the
  Fellow-specific task feed.
- `TRELLO_API_BASE_URL` – optional base URL for the Trello API. Defaults to
  `https://api.trello.com/1` when unset.
- `TRELLO_CARD_LIMIT` – optional cap for the number of cards fetched per request (defaults to `200`).

You can generate an API key and token from Trello by visiting
<https://trello.com/app-key>. Make sure the token is granted read access to every board you want to
include. If you are using a Trello Enterprise workspace, double-check that API access is enabled for
custom integrations.

> **Tip:** You can find a board's ID by opening the board in Trello, choosing **More** → **Link to
> this board**, and copying the identifier from the generated URL (the part between `/b/` and the
> board slug).

## Fellow board setup

Add the board ID of your dedicated Fellow workspace board to `TRELLO_FELLOW_BOARD_IDS`. Multiple
boards can be supported by providing a comma-separated list. The `/api/trello-fellow` endpoint will
only surface cards from these boards and will relabel them with the `Fellow` source badge while still
exposing the Trello metadata (`trelloCardId`, list information, etc.).

If there are Trello boards you never want to see in either feed, list them in
`TRELLO_EXCLUDED_BOARD_IDS`. Cards from excluded boards are ignored even when the board ID appears in
`TRELLO_BOARD_IDS` or `TRELLO_FELLOW_BOARD_IDS`.
