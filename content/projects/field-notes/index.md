---
title: Field Notes
cat: Web app
year: "2026"
order: 1
kind: readme
art: note app
action: Visit
stack: [React, IndexedDB, Local-first]
link: "#"
source: "#"
blurb: A tiny tool for capturing thoughts before they evaporate. **Local-first**, keyboard-driven.
---
## Overview

Field Notes is a small, **local-first** scratchpad for catching ideas before they slip away. No accounts, no sync server you have to trust — everything lives in your browser via IndexedDB, and the whole thing is keyboard-driven.

## The problem

I kept losing half-formed thoughts to the gap between *"I should write that down"* and actually finding somewhere to put it. Every note app I tried wanted me to pick a notebook, a tag, a folder first. Field Notes just opens to a blinking cursor.

## What I built

A single-textarea capture surface with instant full-text search, Markdown rendering, and an export-to-file escape hatch so you're never locked in. It syncs *quietly* across tabs and survives offline.

## Outcome

I use it every day. The interesting lesson was how much friction lived in the *first keystroke* — remove that, and you write far more than you expect.
