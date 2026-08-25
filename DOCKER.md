# Dockerizing ng-admin (BaNazari fork of marmelab/ng-admin)

Everything here is derived from the repo's **Makefile**, **.travis.yml**,
**package.json** and **README**, not inferred.

## The original failure

`node-sass@3.13.1` (resolved from `"node-sass": "^3.9.3"`) has no prebuilt
binary for Node 23, falls back to `node-gyp@3.8.0`, which requires Python 2 —
absent on Fedora 44. `"engines": { "node": ">=4.2.0" }` has no upper bound,
which is why npm never warned about Node 23.

## Facts this container is built on

| Fact                                                                              | Source                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| CI ran on **Node 4**                                                              | `.travis.yml` → `node_js: "4"`                          |
| Dev server port is **8000**                                                       | Makefile `--port 8000`; README says connect to :8000    |
| `make install` = `npm install` **then** `node _postinstall.js`                    | Makefile                                                |
| `make run` = mkdir `examples/blog/build`, copy fakerest + sinon-server, start wds | Makefile                                                |
| wds gets `--port` but **no `--host`**                                             | Makefile                                                |
| `make build` needs **rsync**                                                      | Makefile transpile: `rsync -R \`find . -name \*.html\`` |
| `make build` copies `build/` into `examples/blog/`                                | Makefile                                                |
| `index.html` hardcodes `http://localhost:8000/`                                   | Makefile prepare-test-e2e seds it away                  |
| `make test` includes protractor e2e + needs Xvfb                                  | Makefile + `.travis.yml` `DISPLAY=:99.0`                |
| bower is **never invoked**                                                        | absent from Makefile and package.json                   |
| `_postinstall.js` only fetches Selenium + chromedriver                            | `_postinstall.js`                                       |
| karma picks PhantomJS when `CI` is set                                            | `karma.conf.js`                                         |
| prod bundle also carries `publicPath: http://localhost:8000/`                     | `webpack.config.js` + Makefile `NODE_ENV=production`    |
| webpack output lands at repo-root `build/`                                        | `webpack.config.js` has no `output.path`                |

## Node version choice

`.travis.yml` proves Node **4**. This image uses **6** because it ships npm 3
(Node 4 ships npm 2) and node-sass@3.13.1 still has a prebuilt binary for
Node 6's ABI 48. `FROM node:4` is the literal CI-proven fallback if anything
misbehaves — change one line in `Dockerfile.dev`.

Do **not** switch to `-slim` or `-alpine`: the full buildpack-deps base
supplies `make`, `git` (needed for the `jpetitcolas/ui-codemirror#di`
dependency), g++ and python2.

## `_postinstall.js` is deliberately skipped

**KNOWN** — it does exactly one thing:
`webdriver-manager update --versions.chrome=2.24`, i.e. downloads a Selenium
standalone JAR and chromedriver 2.24 for protractor.

**KNOWN** — irrelevant to `make run` and `make build`; only e2e needs it.
**KNOWN** — its header comment ("runs automatically after the `npm install`")
is false here: package.json has no postinstall hook, the Makefile calls it.
**KNOWN** — it cannot fail a build; the exec callback only logs errors.
**KNOWN** — running Selenium would need Java, absent from `node:6`.

So both Dockerfiles run plain `npm install`. This removes a build-time
dependency on 2016-era Google storage URLs. If you wire up e2e later, run
`node _postinstall.js` explicitly and add a JRE.

## The gotcha that will actually bite

**webpack-dev-server binds localhost.** The Makefile passes `--port 8000`
but no `--host`, so inside a container the server is unreachable from your
host. `docker-compose.yml` overrides the command with the Makefile's exact
sequence plus `--host 0.0.0.0`, so the Makefile stays untouched.

This doesn't conflict with `127.0.0.1:8000:8000`: the app binds broadly
_inside_ the container, Docker exposes it narrowly _on the host_.

## No production image

This setup is a dev environment only: `make run` through the container, for
observing legacy behaviour while porting to React. If you later want to deploy
or freeze a static reference build, a multi-stage Dockerfile ending in nginx
is the right shape — `make build` emits static files into `examples/blog/`,
and nothing needs Node at runtime. Two things it would have to handle:
`rsync` (KNOWN: required by the Makefile's transpile target) and rewriting
`publicPath` / the absolute `http://localhost:8000/` URLs in index.html.

## Don't change the port

**KNOWN** — 8000 is hardcoded in _three_ places:

1. Makefile — `--port 8000`
2. `examples/blog/index.html` — absolute `http://localhost:8000/` URLs
3. `webpack.config.js` — `output.publicPath: "http://localhost:8000/"`

Treat it as a constant. None of this matters for the dev server, which serves on 8000 anyway. It only
becomes a problem if you ever serve the built files from a different origin.

## Commands

```bash
docker compose up --build                  # http://localhost:8000
docker compose exec dev bash
docker compose exec dev make test-unit     # NOT `make test` — see below
docker compose down -v

```

### Tests

**KNOWN** `make test` = `check-only-in-tests` + `test-unit` (karma) +
`test-e2e` (protractor). The e2e leg needs Selenium + a browser and will fail
here. Use `make test-unit`.

**KNOWN** karma.conf.js selects the browser with
`process.env.CI ? 'PhantomJS' : 'Chrome'`. So:

```bash
docker compose exec -e CI=true dev make test-unit
```

picks PhantomJS and sidesteps Chrome/Xvfb entirely — which is why
`.travis.yml`'s `DISPLAY=:99.0` is irrelevant to us.

**KNOWN** PhantomJS then needs `libfontconfig1` + `libfreetype6`. That's the
commented apt block in `Dockerfile.dev` — uncomment it before running tests.

**ASSUMPTION** `phantomjs-prebuilt@2.1.x` downloads its binary from a 2016 URL
during npm install; if that 404s, tests can't run regardless. Unverified.

**ASSUMPTION** Travis ran `gem install compass` but nothing in the Makefile
calls compass, so it's probably vestigial. If a sass build fails oddly,
that's a lead.

### Fedora specifics

`id -u` — if not 1000, adjust the compose `user:` line.
SELinux is enforcing: if `/app` gives permission errors, use `- .:/app:Z`.

## Lockfile

Node 6 ships npm 3, which ignores `package-lock.json`. Use:

```bash
docker compose exec dev npm shrinkwrap   # commit npm-shrinkwrap.json
```

Without it, `^3.9.3`-style ranges re-resolve on every clean build.

## Security posture

This is a modernization workspace, not a deployment. Real risks: 2016
postinstall scripts running on your machine, and exposing an ancient dev
server. Both handled. Base-image CVEs are mostly unreachable code paths.

| Control                               | Where                              |
| ------------------------------------- | ---------------------------------- |
| Loopback-only publish                 | compose `127.0.0.1:8000:8000`      |
| `cap_drop: ALL` + `no-new-privileges` | compose                            |
| Non-root (`USER node`, uid 1000)      | Dockerfile.dev                     |
| Egress blocked at runtime             | `isolated` net, masquerade off     |
| Deps installed in-image               | `.dockerignore` + in-build install |

`npm audit` is worth reading; `npm audit fix` will destroy this tree.

## The durable fix

Replace `node-sass` with `sass` (Dart Sass — pure JS, no node-gyp, no Python).
That removes the Node-version ceiling entirely. `sass-loader@4` is too old to
talk to Dart Sass, so it must be bumped in the same change. Worth doing before
the React migration proper.
