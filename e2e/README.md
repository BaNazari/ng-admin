# e2e — Playwright acceptance suite

Separate package on modern Node (Playwright needs 18+; the repo's own
`package.json`/Makefile toolchain is untouched). Commit this folder at the
repo root, alongside `package.json` and `Makefile`.

Goal: get this suite green against the real AngularJS app first, as a
behavioral baseline ported from `src/javascripts/test/e2e/ListViewSpec.js`.
Later, point it at the React app and get the same file green there.

## Step 0 — apply the data-testid patch (commit this)

`data-testid.patch` adds nine attributes across the actual button/checkbox
directives and the two delete-confirmation templates. It's additive,
invisible at runtime, and it's what the tests below select on:

```bash
git apply data-testid.patch
git status   # confirms exactly these 9 files changed
```

Files touched, all under `src/javascripts/ng-admin/Crud/`:

| File | Attribute added |
|---|---|
| `button/maEditButton.js` | `data-testid="edit-button"` |
| `button/maShowButton.js` | `data-testid="show-button"` |
| `button/maListButton.js` | `data-testid="list-button"` |
| `button/maDeleteButton.js` | `data-testid="delete-button"` |
| `button/maBatchDeleteButton.js` | `data-testid="batch-delete-button"` |
| `button/maViewBatchActions.js` | `data-testid="batch-actions-toggle"` (the "N selected" dropdown trigger) |
| `list/maDatagridItemSelector.js` | `data-testid="row-checkbox"` |
| `delete/delete.html` | `data-testid="delete-confirm"` / `"delete-cancel"` |
| `delete/batchDelete.html` | `data-testid="batch-delete-confirm"` / `"batch-delete-cancel"` |

Two behaviors in the original spec didn't need new attributes — they
already select on stable, pre-existing CSS classes: `td.ng-admin-column-nb_posts`
(tags list) and `.ng-admin-column-title` (translation check). Left as-is.

If `git apply` fails (file drifted since this patch was generated), open
the failing hunk and add the same `data-testid="..."` by hand next to the
existing `class="..."` on that element — the diff shows exactly where.

## Step 1 — install

```bash
cd e2e
npm install
npx playwright install chromium --with-deps
```

Don't commit `node_modules/` or the downloaded browser binary — both are
excluded in `.gitignore`.

## Step 2 — run the baseline

```bash
make run          # from repo root: webpack-dev-server on localhost:8000
```

Then, in another terminal:

```bash
cd e2e
npm test
```

This is deliberately **not** the same target as `make test-e2e` /
Protractor's `localhost:8001` — that one runs against a production webpack
build copied into `src/javascripts/test/fixtures/`, which is unnecessary
overhead for getting a baseline green. `localhost:8000` via `make run` is
the live dev server and is what `playwright.config.js` defaults to.

`tests/list-view.spec.js` covers everything in the original `ListViewSpec.js`:
edit/show navigation, list-button filter preservation across edit and
delete (confirm + cancel), batch-delete visibility and cancellation, the
`prepare`-runs-before-controller check on tags, `entryCssClasses`, and the
no-HTML-escaping translation check. One case — actually deleting a row —
is `test.skip`, mirroring the original's `xit` and its "@TODO allow to
delete item without breaking other test" comment: the suite shares FakeRest
state across tests, so a real delete there would break subsequent runs.

Once green, commit the patch and this spec together — a testid with no
spec using it, or a spec with no testid backing it, isn't a real baseline.

## Step 3 — the other six specs

`DashboardSpec.js`, `EditionViewSpec.js`, `ShowViewSpec.js`,
`filterViewSpec.js`, `paginationSpec.js`, `validationSpec.js` in
`src/javascripts/test/e2e/` get the same treatment: read for behavior, add
whatever `data-testid`s each one needs, write the Playwright version. The
original `*Spec.js` files stay untouched as reference — never run them.

## Later — pointing this at React

```bash
PW_BASE_URL=http://localhost:3000 npm test
```

A spec going red against React means either a genuine regression or a
`data-testid` that didn't make it into the new component — not a reason to
edit the spec.
