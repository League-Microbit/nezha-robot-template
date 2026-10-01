#!/usr/bin/env bash
# deploy.sh — build and flash to a micro:bit.
#
# Usage:
#   bash scripts/deploy.sh              # build locally, flash to the micro:bit
#   bash scripts/deploy.sh --cloud      # cloud build, then flash
#   bash scripts/deploy.sh --flash-only # flash an existing built/binary.hex
#   bash scripts/deploy.sh --drive /Volumes/OTHER  # flash to a specific drive
#   bash scripts/deploy.sh --robot tigez # build FOR tigez, then flash
#
# The micro:bit's drive is found by its MICROBIT label, wherever the OS mounted
# it: /Volumes/MICROBIT on macOS, /media/<user>/MICROBIT on Ubuntu. --drive, or
# MICROBIT in the environment, names one explicitly and skips the search --
# which is what you need with two boards plugged in.
#
# --robot is passed through to scripts/build.sh, which bakes the name into the
# extension's kProfile at COMPILE time -- so it selects what gets built, not
# where it gets flashed. With --flash-only it selects nothing and is used only
# to check the hex on disk was built for the robot you named.
set -euo pipefail

MODE="--local"
DRIVE="${MICROBIT:-}"
DO_BUILD=1
ROBOT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --cloud) MODE="--cloud"; shift ;;
        --local) MODE="--local"; shift ;;
        --flash-only) DO_BUILD=0; shift ;;
        --drive) DRIVE="$2"; shift 2 ;;
        --robot) ROBOT="${2:-}"; [ -n "$ROBOT" ] || { echo "--robot needs a board name" >&2; exit 1; }; shift 2 ;;
        *) echo "Unknown flag: $1" >&2; exit 1 ;;
    esac
done

cd "$(dirname "$0")/.."

HEX="built/binary.hex"

# Build
if [ "$DO_BUILD" -eq 1 ]; then
    if [ -n "$ROBOT" ]; then
        bash scripts/build.sh "$MODE" --robot "$ROBOT"
    else
        bash scripts/build.sh "$MODE"
    fi
elif [ ! -f "$HEX" ]; then
    echo "ERROR: $HEX not found — run 'npm run build' first" >&2
    exit 1
else
    # --flash-only: nothing is compiled, so the profile in this hex is whatever
    # the last build baked. That is the one case where the name on the wire can
    # silently disagree with the board in your hand -- flashing tigez's build
    # onto gopiv leaves a robot confidently answering ID with the wrong robot,
    # which is harder to debug than the "unbaked" it used to say. Refuse.
    BAKED=$(cat built/.baked-profile 2>/dev/null || echo "unknown")
    if [ -n "$ROBOT" ] && [ "$BAKED" != "$ROBOT" ]; then
        echo "ERROR: $HEX was built for profile '$BAKED', not '$ROBOT'." >&2
        echo "  Rebuild for this robot:  bash scripts/deploy.sh --robot $ROBOT" >&2
        exit 1
    fi
    echo "Flashing a hex built for profile: $BAKED"
fi

# ---- finding the micro:bit's drive -----------------------------------------
#
# Every mounted MICROBIT drive, one path per line. Newline-separated text, not
# an array: bash 3.2 (macOS) errors on expanding an empty array under `set -u`.
#
# Linux asks lsblk for the LABEL rather than globbing /media: the mount point
# is the desktop's choice (/media/<user>/, /run/media/<user>/, and MICROBIT1
# for a second board), but the label is the board's own and is always MICROBIT.
# lsblk -r writes a space in a path as \x20, which printf %b turns back.
microbit_drives() {
    if [ "$(uname)" = "Darwin" ]; then
        for d in /Volumes/MICROBIT*; do
            [ -d "$d" ] && echo "$d"
        done
    elif command -v lsblk >/dev/null 2>&1; then
        lsblk -rno LABEL,MOUNTPOINT 2>/dev/null \
            | awk '$1 == "MICROBIT" && $2 != "" { print $2 }' \
            | while IFS= read -r m; do printf '%b\n' "$m"; done
    fi
    return 0
}

# Linux only: a micro:bit that is plugged in but not mounted -- ejected in the
# file manager, or plugged in over ssh where no desktop is watching. udisksctl
# mounts it as the logged-in user, no root needed; a failure is not fatal here,
# the "not found" message below covers it.
mount_microbits() {
    command -v lsblk >/dev/null 2>&1 && command -v udisksctl >/dev/null 2>&1 || return 0
    lsblk -rno PATH,LABEL,MOUNTPOINT 2>/dev/null \
        | awk '$2 == "MICROBIT" && $3 == "" { print $1 }' \
        | while IFS= read -r dev; do
            udisksctl mount -b "$dev" --no-user-interaction >/dev/null 2>&1 || true
        done
    return 0
}

if [ -z "$DRIVE" ]; then
    FOUND=$(microbit_drives)
    if [ -z "$FOUND" ] && [ "$(uname)" != "Darwin" ]; then
        mount_microbits
        FOUND=$(microbit_drives)
    fi
    COUNT=$(printf '%s' "$FOUND" | grep -c . || true)
    if [ "$COUNT" -eq 0 ]; then
        echo "ERROR: no MICROBIT drive found. Plug in your micro:bit." >&2
        exit 1
    elif [ "$COUNT" -gt 1 ]; then
        echo "ERROR: more than one micro:bit is plugged in:" >&2
        printf '%s\n' "$FOUND" | sed 's/^/    /' >&2
        echo "  Unplug all but one, or pick one:  bash scripts/deploy.sh --drive <path>" >&2
        exit 1
    fi
    DRIVE="$FOUND"
fi

# Flash
if [ ! -d "$DRIVE" ]; then
    echo "ERROR: $DRIVE is not mounted. Plug in your micro:bit." >&2
    exit 1
fi

# macOS: -X drops extended attributes, which the micro:bit's FAT volume rejects.
# Plain string, not an array — see the note in code.sh: bash 3.2 (macOS) errors
# on expanding an empty array under `set -u`.
CP_FLAGS=""
if [ "$(uname)" = "Darwin" ]; then
    CP_FLAGS="-X"
fi

# shellcheck disable=SC2086
cp $CP_FLAGS "$HEX" "$DRIVE/"
# Linux returns from cp with the hex still in the page cache; the board only
# starts flashing once it reaches the drive.
sync
echo ""
echo "✓ Flashed $(basename "$HEX") → $DRIVE"
echo "  The micro:bit LED should flash while copying, then reboot."
