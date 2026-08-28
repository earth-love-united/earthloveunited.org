# ELU self-hosted fonts

These WOFF2 files preserve Earth Love United's existing typography without a
runtime request to Google Fonts. They were fetched on 2026-08-28 from the exact
`fonts.gstatic.com` URLs returned by the official Google Fonts CSS API for:

- Cormorant Garamond 300, 400, and 600 (v21)
- Outfit 300, 400, 500, and 600 (v15)
- JetBrains Mono 400 and 500 (v24)

The files are variable fonts. The CSS in `index.html` exposes only the weight
ranges already used by the site and splits Latin from Latin Extended so the
browser downloads only the glyph coverage it needs.

| File | SHA-256 |
|---|---|
| `cormorant-garamond-latin.woff2` | `d80df8ff5aecd299a61549f9e29ab1ed0b9b05f4ea71d50fe978e07d5240b235` |
| `cormorant-garamond-latin-ext.woff2` | `cfa9a397d86f66c5c51775a2500a712d5f632a04f0c5eca6930dfaf612d4566d` |
| `outfit-latin.woff2` | `6c18d579fd87c3776be068b762cbc83fde3acb543d49eabd3ade842eb987e887` |
| `outfit-latin-ext.woff2` | `0f53d1c03b3918d744a843b5039001ee31695ca1e255e3914188df81beb461e9` |
| `jetbrains-mono-latin.woff2` | `83c005d49d8a6a50474c73a5a36ac0468076e9c4a29da7bdb14995d80560a5be` |
| `jetbrains-mono-latin-ext.woff2` | `db5ff4db83e580426280e9337a58dc57d3a83784a1b03ad80914651594441d52` |

Each family is distributed under the SIL Open Font License 1.1. The exact
upstream licence files, including their family-specific copyright notices, are
stored alongside the fonts as `OFL-cormorant-garamond.txt`,
`OFL-outfit.txt`, and `OFL-jetbrains-mono.txt`.
