# ELU self-hosted fonts

These WOFF2 files preserve Earth Love United's existing typography without a
runtime request to Google Fonts. They were fetched on 2026-08-28 from the exact
`fonts.gstatic.com` URLs returned by the official Google Fonts CSS API for:

- Cormorant Garamond 300, 400, and 600 (v21)
- Outfit 300, 400, 500, and 600 (v15)
- JetBrains Mono 400 and 500 (v24)

The upstream files are variable fonts. The CSS in `index.html` exposes only the
weight ranges already used by the site and keeps Latin and Latin Extended as
on-demand fallback families.

For first paint, the three `*-site.woff2` derivatives contain a compact
code-point set derived from the rendered page copy as of 2026-08-28. They were
deterministically subset from the matching Latin files with fontTools 4.61.1;
font outlines, variation axes, shaping features, and hinting are retained.
Characters outside that compact set fall through to the complete self-hosted
Latin or Latin Extended family, so names with accents keep the same typeface.

| File | SHA-256 |
|---|---|
| `cormorant-garamond-latin.woff2` | `d80df8ff5aecd299a61549f9e29ab1ed0b9b05f4ea71d50fe978e07d5240b235` |
| `cormorant-garamond-latin-ext.woff2` | `cfa9a397d86f66c5c51775a2500a712d5f632a04f0c5eca6930dfaf612d4566d` |
| `outfit-latin.woff2` | `6c18d579fd87c3776be068b762cbc83fde3acb543d49eabd3ade842eb987e887` |
| `outfit-latin-ext.woff2` | `0f53d1c03b3918d744a843b5039001ee31695ca1e255e3914188df81beb461e9` |
| `jetbrains-mono-latin.woff2` | `83c005d49d8a6a50474c73a5a36ac0468076e9c4a29da7bdb14995d80560a5be` |
| `jetbrains-mono-latin-ext.woff2` | `db5ff4db83e580426280e9337a58dc57d3a83784a1b03ad80914651594441d52` |
| `cormorant-garamond-site.woff2` | `7f4b7877020b1eec89781e6e2be59825456b59e1ec99412e2af78472ce0b0423` |
| `outfit-site.woff2` | `fff758eb92d35deee7cddeb11edcb2b6fafbbc78f207392772aca440c9277877` |
| `jetbrains-mono-site.woff2` | `317775f7afde0159f060f6cb6590ab7f4c2a167e6fd579a635b5e5652736ea68` |

Each family is distributed under the SIL Open Font License 1.1. The exact
upstream licence files, including their family-specific copyright notices, are
stored alongside the fonts as `OFL-cormorant-garamond.txt`,
`OFL-outfit.txt`, and `OFL-jetbrains-mono.txt`.
