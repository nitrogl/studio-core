#!/bin/bash
#
# Builds every docs/**/*.md into the .html next to it, with pandoc
#
# WARNING Call from outside docs/: tools/build-docs.sh
#         (it looks for docs/site.conf)
#
# Conventions I'm forgetting in a minute:
#   - the title of a page is its first "# " line (no &, < or > in it);
#   - NN-name.md next to an index.md is a chapter of a book: it links to the
#     index and to the chapters before and after it;
#   - a page with three "## " sections or more gets a table of contents;
#   - docs/syntax/*.xml highlight the code blocks of their language;
#   - the addresses of docs/site.conf are relative to docs/, and the other
#     repositories are next to this one: ../../NAME/index.html (index.html,
#     for the browser to open them from disk too).
#
# SPDX-License-Identifier: MIT

set -e

TOOL="$(cd "$(dirname "$0")" && pwd)/docs"

title="Documentation"
repo=""
nav=()
actions=""
source docs/site.conf

mkdir -p docs/assets
cp "$TOOL/style.css" docs/assets/
[ -n "$actions" ] && cp "$TOOL/code-actions.js" docs/assets/

SYNTAX=()
for xml in docs/syntax/*.xml; do
  [ -f "$xml" ] && SYNTAX+=(--syntax-definition "$PWD/$xml")
done

# The title of a page, without the marks of code and the escapes
title_of() {
  sed -n 's/^# //p' "$1" | head -1 | sed 's/[`\\]//g'
}

count=0
for md in $(find docs -name "*.md" -not -path "docs/assets/*" | sort); do
  page="${md#docs/}"
  dir="$(dirname "$md")"
  name="$(basename "$md")"
  root="$(realpath -m --relative-to="$dir" docs)/"
  [ "$root" = "./" ] && root=""

  links=""
  for item in "${nav[@]}"; do
    href="${item%%|*}"
    current=""
    [ "$href" = "$page" ] && current=' class="current"'
    [[ "$href" == *.md ]] && href="${href%.md}.html"
    [[ "$href" =~ ^https?:// ]] || href="$root$href"
    links+="<a href=\"$href\"$current>${item#*|}</a>"
  done

  options=(-V "site-title=$title" -V "root=$root" -V "nav=$links")
  options+=(-V "footer=<a href=\"$name\">$md</a> in $repo")
  [ -n "$actions" ] && options+=(-V "code-actions=$actions")
  [ "$(grep -c '^## ' "$md")" -ge 3 ] && options+=(--toc --toc-depth=3)

  if [[ "$name" =~ ^[0-9][0-9]- ]]; then
    chapters=("$dir/index.md" "$dir"/[0-9][0-9]-*.md)
    for i in "${!chapters[@]}"; do
      [ "${chapters[$i]}" = "$md" ] && at=$i
    done
    before="${chapters[$((at - 1))]}"
    after="${chapters[$((at + 1))]}"
    prevnext="<a class=\"prev\" href=\"$(basename "${before%.md}").html\">&larr; $(title_of "$before")</a>"
    [ -n "$after" ] && prevnext+="<a class=\"next\" href=\"$(basename "${after%.md}").html\">$(title_of "$after") &rarr;</a>"
    options+=(-V "book=<a href=\"index.html\">$(title_of "$dir/index.md")</a>" -V "prev-next=$prevnext")
  fi

  # pandoc runs in the folder of the page, where its images are
  (cd "$dir" && pandoc "$name" -f markdown+gfm_auto_identifiers -t html5 -s --mathml --wrap=none \
    --template "$TOOL/template.html" --lua-filter "$TOOL/docs.lua" -M "folder=$dir" \
    "${SYNTAX[@]}" "${options[@]}" -o "${name%.md}.html")
  count=$((count + 1))
done

echo "Built $count pages of docs/"
