---
title: Tinybase
cat: Open source
year: "2025"
kind: readme
art: sync
action: GitHub
stack: [TypeScript, CRDTs, WASM]
link: "#"
source: "#"
blurb: Experiments with **local-first** data and quiet background sync.
---
## Overview

Tinybase is a sandbox for one idea: data that lives on your device first, and syncs in the background without you ever thinking about it.

## What I built

A tiny CRDT store compiled to WASM, with a sync adapter that batches changes and resolves conflicts deterministically. Offline edits just *work* and merge cleanly when you reconnect.

## Outcome

CRDTs are easy to describe and hard to make boring — in the good sense. Getting sync to feel like *nothing happened* was the entire challenge.
