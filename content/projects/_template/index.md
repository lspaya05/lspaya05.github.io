---
# Copy this whole _template/ FOLDER to content/projects/my-thing/ to add a
# project. Keep the file named index.md; drop images/assets in the folder
# next to it. (The leading underscore keeps _template out of the manifest.)
title: My Thing
cat: Web app            # the small uppercase label on the card
year: "2026"            # projects sort by year (newest first)
kind: readme            # readme = full layout with hero + buttons | essay = prose
action: Visit           # label for the primary button
stack: [TypeScript, React]   # tech chips (readme only)
image: ./cover.png      # OPTIONAL — co-locate the file in this folder; omit for the gradient
link: https://example.com    # OPTIONAL — primary button target
source: https://github.com/you/my-thing   # OPTIONAL — "Source" button
art: my thing           # text shown in the placeholder gradient when no image
blurb: One sentence for the card. **Bold**, _italic_, and [links](https://x.com) work here.
# essay-only fields:
# essayDate: March 4, 2026
# essayLead: A punchy opening line shown large at the top of the essay.
---
## Overview

Full **markdown** body — headings, _italics_, [links](https://example.com), lists,
images, and quotes all render here. Embeds are allowed from a safelist
(YouTube / Vimeo / Loom / Google Maps):

<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ"></iframe>

## The problem

What itch did this scratch?

## What I built

The thing.

## Outcome

What you learned.
