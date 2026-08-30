// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Ported from src/javascripts/test/e2e/ListViewSpec.js.
 *
 * The original file stays in the legacy tree, untouched, as reference —
 * it's Protractor syntax and cannot run under Playwright. This is a
 * behavior-for-behavior rewrite, checked against the actual spec source
 * (not reconstructed from memory).
 *
 * PREREQUISITE: apply data-testid.patch first — none of this is green
 * without it. It adds data-testid to: maEditButton, maShowButton,
 * maListButton, maDeleteButton, maBatchDeleteButton, the batch-actions
 * dropdown toggle, the row checkbox, and both delete-confirmation dialogs
 * (single delete + batch delete).
 *
 * Target: `make run` (webpack-dev-server on :8000, blog example — posts,
 * comments, tags via FakeRest). Not the Protractor json-server on :8001;
 * that one needs a full prod webpack build first and isn't needed here.
 */

test.describe('ListView', () => {
  test('edit button navigates to the edit view', async ({ page }) => {
    await page.goto('/#/posts/list');
    await page.locator('[data-testid="edit-button"]').first().click();
    await expect(page).toHaveURL(/\/posts\/edit\//);
  });

  test('show button navigates to the show view', async ({ page }) => {
    await page.goto('/#/posts/list');
    await page.locator('[data-testid="show-button"]').first().click();
    await expect(page).toHaveURL(/\/posts\/show\//);
  });

  test.describe('list button restores a filtered list', () => {
    const listUrl = '/#/comments/list?search={"post_id":"9"}';
    // The browser percent-encodes {, }, and " in the query string, but
    // leaves : as-is — this matches that exactly, character for character.
    const encodedListUrl = encodeURI(listUrl);

    test('after edit', async ({ page }) => {
      await page.goto(listUrl);
      const editLink = page.locator('[data-testid="edit-button"]').first();
      await expect(editLink).toHaveText(/Edit/);
      await editLink.click();
      await expect(page).toHaveURL(/#\/comments\/edit\/2$/);

      await page.locator('[data-testid="list-button"]').first().click();
      await expect(page).toHaveURL(encodedListUrl);
    });

    test('after delete confirmation', async ({ page }) => {
      await page.goto(listUrl);
      const deleteLink = page.locator('[data-testid="delete-button"]').first();
      await expect(deleteLink).toHaveText(/Delete/);
      await deleteLink.click();
      await expect(page).toHaveURL(/#\/comments\/delete\/2$/);

      await page.locator('[data-testid="delete-confirm"]').click();
      await expect(page).toHaveURL(encodedListUrl);
    });

    test('after delete cancel', async ({ page }) => {
      await page.goto(listUrl);
      const deleteLink = page.locator('[data-testid="delete-button"]').first();
      await deleteLink.click();
      await expect(page).toHaveURL(/#\/comments\/delete\/2$/);

      await page.locator('[data-testid="delete-cancel"]').click();
      await expect(page).toHaveURL(encodedListUrl);
    });
  });

  test.describe('batch delete', () => {
    test('button only appears once a row is selected', async ({ page }) => {
      await page.goto('/#/comments/list');
      await expect(page.locator('[data-testid="batch-actions-toggle"]')).toHaveCount(0);

      await page.locator('[data-testid="row-checkbox"]').first().click();
      await expect(page.locator('[data-testid="batch-actions-toggle"]')).toHaveCount(1);
    });

    test('declining the confirmation leaves the list unchanged', async ({ page }) => {
      await page.goto('/#/comments/list');
      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();
      const rowCountBefore = await rows.count();

      await page.locator('[data-testid="row-checkbox"]').first().click();
      await page.locator('[data-testid="batch-actions-toggle"]').click();
      await page.locator('[data-testid="batch-delete-button"]').click();
      await expect(page).toHaveURL(/#\/comments\/batch-delete\//);

      await page.locator('[data-testid="batch-delete-cancel"]').click();
      await expect(page).toHaveURL(/#\/comments\/list/);
      await expect(rows).toHaveCount(rowCountBefore);
    });

    // Original had this case as `xit` (skipped) — "@TODO allow to delete
    // item without breaking other test" — the suite is order-dependent
    // against shared FakeRest state. Kept skipped for the same reason;
    // un-skip only once the fixture data is reset between tests.
    test.skip('confirming deletes the selected row', async ({ page }) => {
      await page.goto('/#/comments/list');
      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();
      const rowCountBefore = await rows.count();

      await page.locator('[data-testid="row-checkbox"]').first().click();
      await page.locator('[data-testid="batch-actions-toggle"]').click();
      await page.locator('[data-testid="batch-delete-button"]').click();

      await page.locator('[data-testid="batch-delete-confirm"]').click();
      await expect(page).toHaveURL(/#\/comments\/list/);
      await expect(rows).toHaveCount(rowCountBefore - 1);
    });
  });

  test('prepare runs after resolve and before the controller', async ({ page }) => {
    // Tags list shows nb_posts=2 for the first row — only true if
    // `prepare` ran and enriched the entry before the controller read it.
    await page.goto('/#/tags/list');
    await expect(page.locator('td.ng-admin-column-nb_posts').first()).toHaveText('2');
  });

  test('entryCssClasses sets a class on the row per entry', async ({ page }) => {
    await page.goto('/#/posts/list');
    const rows = page.locator('tbody tr');
    await expect(rows.nth(0)).toHaveClass(/is-popular/);
    await expect(rows.nth(1)).not.toHaveClass(/is-popular/);
  });

  test('translated text is not HTML-escaped', async ({ page }) => {
    await page.goto('/#/posts/list');
    const title = page.locator('tbody tr:last-child .ng-admin-column-title').first();
    await expect(title).toHaveText('Accusantium qui nihil & voluptatum quia voluptas maxime ab similique');
  });
});
