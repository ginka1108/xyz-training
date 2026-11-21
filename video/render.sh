#!/bin/sh
# 動画を書き出す。フォルダ名に日本語が入っていると Remotion の書き出しが止まるため、
# 一時フォルダ（英数字のパス）にコピーしてから書き出し、out/ に戻す。
set -e
cd "$(dirname "$0")"
TMP="${TMPDIR:-/tmp}/xyz-video-render"
mkdir -p "$TMP" out
rsync -a --delete --exclude out ./ "$TMP/"
(cd "$TMP" && npx remotion render XYZ out/xyz-training.mp4 --codec=h264 --crf=20 "$@")
cp "$TMP/out/xyz-training.mp4" out/
echo "→ out/xyz-training.mp4"
