# ng-admin Codebase Metrics

Scoped to `src/` (excludes `node_modules`, `build`, `doc`, `examples`).

| Metric | Count | Notes |
|---|---|---|
| LOC (total) | 9,582 | JS + HTML + Sass combined |
| LOC (JS) | 8,590 | 4,673 production + 3,902 test |
| LOC (HTML) | 305 | 12 template files |
| JS files | 160 | 109 production + 49 test/mock |
| HTML files | 12 | plus 48 JS files with inline `template:` strings |
| Angular modules | 3 | `AdminDescriptionModule`, `crud`, `main` |
| Controllers | 8 | e.g. `ListController`, `FormController`, `AppController` |
| Directives | 57 | bulk of the codebase — fields, columns, buttons, etc. |
| Services | 6 | (+3 `.factory()` registrations: `Papa`, `notification`, `progression`; +3 `.provider()`: `FieldViewConfiguration`, `HttpErrorService`, `NgAdminConfiguration`) |
| Filters | 2 | `orderElement`, `stripTags` |
| Templates | 12 | `.html` files (+48 inline `template:` strings in directives) |
| Tests | 39 | spec files (32 unit + 7 e2e), 179 individual test cases (`it()` blocks: 136 unit + 43 e2e) |