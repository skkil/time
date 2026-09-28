#!/usr/bin/env sh
# Renders the Android adaptive icon layers from the repo's master icon.
# Needs rsvg-convert and ImageMagick.
set -eu
cd "$(dirname "$0")/.."
master=../../assets/icon.svg
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

rsvg-convert -w 676 -h 676 "$master" -o "$work/icon.png"
magick -size 1024x1024 xc:none "$work/icon.png" -gravity center -composite assets/android-icon-foreground.png
magick assets/android-icon-foreground.png -alpha extract -background white -alpha shape assets/android-icon-monochrome.png
magick -size 1024x1024 xc:'#1A1D21' assets/android-icon-background.png
