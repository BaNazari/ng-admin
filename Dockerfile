# syntax=docker/dockerfile:1
# ===========================================================================
# ng-admin — DEVELOPMENT image
#
# Claims below are marked KNOWN (traceable to a repo file) or
# ASSUMPTION (inference, unverified).
#
# NODE 6:
#   KNOWN     .travis.yml pins node_js: "4" — the only proven version.
#   KNOWN     package.json resolves node-sass to 3.13.1 (from ^3.9.3).
#   ASSUMPTION 3.13.1's prebuilt binary covers Node 6's ABI 48, so nothing
#              compiles and no python2/node-gyp is needed. If this is wrong,
#              `FROM node:4` is the CI-proven fallback (costs you npm 2).
#
# FULL IMAGE, NOT -slim/-alpine:
#   KNOWN     Makefile drives everything -> needs `make`.
#   KNOWN     package.json has "jpetitcolas/ui-codemirror#di" -> needs `git`.
#   ASSUMPTION buildpack-deps (this image's base) supplies both.
# ===========================================================================
FROM node:6

# KNOWN  Node 6 ships npm 3.10.10, which cannot create/populate @scope/
#        directories in its .staging area on this filesystem. Two observed
#        failures, both scoped packages:
#          ENOTDIR  .staging/@types/jasmine-.../package.json   (project deps)
#          ENOENT   rename .staging/@iarna/cli-...             (npm's own deps)
#        The second means `npm install -g npm@6` ALSO fails — npm 3 is too
#        broken to install its own replacement.
# KNOWN  npm's published tarball bundles all of its dependencies, so it can
#        be unpacked directly with tar, using no npm at all.
# ASSUMPTION npm 6.14.18 is the last npm 6 and still supports Node 6.
#        Fallback if it misbehaves: yarn 1.x (self-contained, no scoped deps,
#        so npm 3 can install it) via `npm install -g yarn@1.22.19`, then
#        swap `npm install` below for `yarn install`.
RUN curl -fsSL https://registry.npmjs.org/npm/-/npm-6.14.18.tgz -o /tmp/npm.tgz \
 && rm -rf /usr/local/lib/node_modules/npm \
 && mkdir -p /usr/local/lib/node_modules/npm \
 && tar -xzf /tmp/npm.tgz -C /usr/local/lib/node_modules/npm --strip-components=1 \
 && rm /tmp/npm.tgz \
 && npm --version

WORKDIR /app
RUN chown -R node:node /app

# --- OPTIONAL: unit tests only ---------------------------------------------
# KNOWN  karma.conf.js: browsers = [process.env.CI ? 'PhantomJS' : 'Chrome'],
#        so CI=true selects PhantomJS and no Chrome/Xvfb is needed.
# KNOWN  PhantomJS needs libfontconfig1 + libfreetype6 to execute.
# KNOWN  Debian jessie/stretch are EOL -> apt needs the archive redirect.
#
# Left commented because enabling it puts an EOL apt mirror on the critical
# path of your main dev image. Uncomment only when you want `make test-unit`.
#
# USER root
# RUN sed -i 's|deb.debian.org|archive.debian.org|g; s|security.debian.org|archive.debian.org|g; /-updates/d' /etc/apt/sources.list \
#  && echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid-until \
#  && apt-get update \
#  && apt-get install -y --no-install-recommends libfontconfig1 libfreetype6 \
#  && rm -rf /var/lib/apt/lists/*
# ---------------------------------------------------------------------------

USER node

COPY --chown=node:node package.json package-lock.json* npm-shrinkwrap.json* ./

# _postinstall.js is deliberately NOT run here.
#   KNOWN  It only executes `webdriver-manager update --versions.chrome=2.24`,
#          i.e. it downloads a Selenium JAR + chromedriver for protractor e2e.
#   KNOWN  It is irrelevant to `make run` and `make build`.
#   KNOWN  Its own header comment claims npm runs it automatically; false —
#          package.json has no postinstall hook, the Makefile calls it.
#   KNOWN  Running Selenium would also need Java, absent from this image.
# Skipping it removes a build-time dependency on 2016-era Google storage URLs.
# If you ever wire up e2e, run it explicitly: `node _postinstall.js`.
RUN npm install

COPY --chown=node:node . .

# KNOWN  Port 8000 is hardcoded in three places: Makefile (--port 8000),
#        examples/blog/index.html (absolute http://localhost:8000/ URLs), and
#        webpack.config.js (output.publicPath). It is a constant, not a knob.
EXPOSE 8000

# KNOWN  Makefile's run target passes --port but NO --host, so
#        webpack-dev-server binds localhost and is unreachable from the host.
#        compose overrides this command to add --host 0.0.0.0.
CMD ["make", "run"]
