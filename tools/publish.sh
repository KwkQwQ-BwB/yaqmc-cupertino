#!/usr/bin/env bash
# Publishes this plugin: GitHub repo (topic yaqmc-plugin), push, and Release v1.0.0 with the package.
# Needs an authenticated GitHub CLI (`gh auth status`) and Node.js >= 22.2. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_NAME="${1:-yaqmc-cupertino}"
VERSION="$(node -p "require('./manifest.json').version")"
TAG="v$VERSION"

gh auth status >/dev/null
OWNER="$(gh api user --jq .login)"
URL="https://github.com/$OWNER/$REPO_NAME"

# Point the manifest at the published repository before packing.
node -e '
const fs = require("fs"); const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const u = process.argv[1]; if (m.repository === u) process.exit(0);
const { entrypoints, permissions, settingsSchema, ...head } = m;
fs.writeFileSync("manifest.json", JSON.stringify({ ...head, homepage: u, repository: u, entrypoints, permissions, settingsSchema }, null, 2) + "\n");
' "$URL"
node tools/build.mjs
node --test
git add -A
git diff --cached --quiet || git commit -q -m "Point manifest at $URL"

if ! gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO_NAME" --public --source . --remote origin \
    --description "Apple-inspired redesign plugin for YAQMC: macOS, iOS and iPadOS layouts in Classic or Liquid Glass"
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "$URL.git"
git push -u origin main
gh repo edit "$OWNER/$REPO_NAME" --add-topic yaqmc-plugin --add-topic yaqmc --homepage "$URL"

PKG="dist/dev.cupertino.yaqmc-$VERSION.yaqmc-plugin"
SHA="$(sha256sum "$PKG" | cut -d' ' -f1)"
NOTES="$(mktemp)"
sed -e "s/{{OWNER}}/$OWNER/g" -e "s/{{REPO}}/$REPO_NAME/g" -e "s/{{SHA}}/$SHA/g" -e "s/{{VERSION}}/$VERSION/g" \
  docs/release-notes.md > "$NOTES"
if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$PKG" --clobber
  gh release edit "$TAG" --notes-file "$NOTES"
else
  gh release create "$TAG" "$PKG" --title "Cupertino $VERSION" --notes-file "$NOTES" --target main
fi
echo "Repository: $URL"
echo "Release:    $URL/releases/tag/$TAG"
