"""
═══════════════════════════════════════════════════════════════════════════
  VERRA DETAIL SCRAPER — Angular SPA → Description + Methodology
  
  The Verra registry (registry.verra.org) renders project details as an
  Angular SPA. curl gets empty HTML shell. LightPanda CDP renders the
  full DOM and we extract the description + any additional metadata.
  
  URL pattern: https://registry.verra.org/app/projectDetail/VCS/{id}
═══════════════════════════════════════════════════════════════════════════
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger("scraper.verra")

# Base URL for Verra project detail pages
VERRA_DETAIL_URL = "https://registry.verra.org/app/projectDetail/VCS/{project_id}"


def build_verra_urls(raw_jsonl_path: str) -> list[dict]:
    """
    Read the raw Verra JSONL and build URL list for projects
    that need descriptions.
    
    Returns list of {"url": "...", "project_id": "...", "name": "..."}.
    """
    projects = []
    with open(raw_jsonl_path) as f:
        for line in f:
            p = json.loads(line)
            pid = p.get("resourceIdentifier", "")
            if pid:
                projects.append({
                    "url": VERRA_DETAIL_URL.format(project_id=pid),
                    "project_id": pid,
                    "name": p.get("resourceName", ""),
                })
    logger.info(f"Built {len(projects)} Verra detail URLs")
    return projects


def build_verra_urls_needing_descriptions(
    raw_jsonl_path: str,
    existing_output_path: str = None,
) -> list[dict]:
    """
    Build URLs only for projects that don't already have descriptions.
    Checks existing output JSONL to skip already-scraped ones.
    """
    # Load already-scraped project IDs from output
    already_scraped = set()
    if existing_output_path and Path(existing_output_path).exists():
        with open(existing_output_path) as f:
            for line in f:
                try:
                    d = json.loads(line)
                    if d.get("project_id"):
                        already_scraped.add(str(d["project_id"]))
                except json.JSONDecodeError:
                    continue
        logger.info(f"Already scraped: {len(already_scraped)} projects")

    all_projects = build_verra_urls(raw_jsonl_path)
    needed = [p for p in all_projects if p["project_id"] not in already_scraped]
    logger.info(f"Need to scrape: {len(needed)} / {len(all_projects)} projects")
    return needed


async def extract_verra_detail(page, url: str) -> dict | None:
    """
    Extract project details from a rendered Verra detail page.
    
    This is the extractor function passed to BatchRunner.
    Called after page.goto() has completed and JS has rendered.
    
    Returns:
        dict with project_id, description, methodology_name, etc.
        None if extraction failed.
    """
    # Extract the project ID from the URL
    project_id = url.rstrip("/").split("/")[-1]
    
    # Wait for the Angular app to render content
    try:
        await page.wait_for_selector(
            ".project-details, .tab-content, .detail-container, "
            "[class*='project'], main, .content-area",
            timeout=12000,
        )
    except Exception:
        # If no selector matched, the page might still have rendered
        logger.debug(f"No familiar selector found for {project_id}, attempting extraction anyway")

    # Give Angular a moment to finish rendering after DOM appears
    await page.wait_for_timeout(1500)

    result = await page.evaluate(
        """() => {
            const data = {
                description: null,
                methodology_name: null,
                project_type: null,
                proponent: null,
                project_status: null,
                estimated_annual_reductions: null,
                validator: null,
                registration_date: null,
                crediting_period: null,
                state_province: null,
                sdgs: null,
                raw_text: null,
            };

            const bodyText = document.body.innerText;
            const NL = String.fromCharCode(10);  // newline char, no escaping issues

            // Helper: extract the value line after a field name
            function getField(fieldName) {
                const marker = fieldName + NL;
                const idx = bodyText.indexOf(marker);
                if (idx < 0) return null;
                const after = bodyText.substring(idx + marker.length);
                const endIdx = after.indexOf(NL);
                const val = (endIdx >= 0 ? after.substring(0, endIdx) : after.substring(0, 200)).trim();
                return val.length > 0 ? val : null;
            }

            // ── Description ──
            const docsMarker = bodyText.indexOf('VCS PIPELINE DOCUMENTS');
            if (docsMarker > 0) {
                const doubleNL = NL + NL;
                const headerEnd = bodyText.indexOf(doubleNL);
                const start = headerEnd > 0 ? headerEnd : 100;
                const descBlock = bodyText.substring(start, docsMarker).trim();
                const lines = descBlock.split(NL).filter(l => {
                    const t = l.trim();
                    return t.length > 30 &&
                           !t.startsWith('\u00a9') &&
                           !t.startsWith('Home /') &&
                           !t.includes('TomTom') &&
                           !/^[A-Z\u00d7\\d\\s\\-&]+$/.test(t);
                });
                if (lines.length > 0) {
                    data.description = lines.join(' ').trim().substring(0, 3000);
                }
            }
            if (!data.description) {
                const blocks = document.querySelectorAll('p, div');
                let longest = '';
                for (const block of blocks) {
                    const text = block.innerText.trim();
                    if (text.length > longest.length && text.length > 100 && text.length < 5000) {
                        if (!text.includes('Document Name') && !text.includes('Date Updated')) {
                            longest = text;
                        }
                    }
                }
                if (longest) data.description = longest.substring(0, 3000);
            }

            // ── Structured fields ──
            data.methodology_name = getField('VCS Methodology');
            data.project_type = getField('VCS Project Type');
            data.project_status = getField('VCS Project Status');
            data.proponent = getField('Proponent');
            data.validator = getField('VCS Project Validator');
            data.registration_date = getField('Project Registration Date');
            data.crediting_period = getField('Crediting Period Term');
            data.state_province = getField('State/Province');

            const earVal = getField('Estimated Annual Emission Reductions');
            if (earVal) {
                const num = parseInt(earVal.replace(/,/g, ''));
                if (!isNaN(num)) data.estimated_annual_reductions = num;
            }

            // ── SDGs ──
            const sdgEls = document.querySelectorAll('[class*="sdg"], [class*="SDG"], img[alt*="SDG"]');
            if (sdgEls.length > 0) {
                data.sdgs = [];
                for (const el of sdgEls) {
                    const m = (el.innerText || '').match(/(\\d+)/) || (el.alt || '').match(/(\\d+)/);
                    if (m) data.sdgs.push(parseInt(m[1]));
                }
                if (data.sdgs.length === 0) data.sdgs = null;
            }

            data.raw_text = bodyText.substring(0, 1000);
            return data;
        }"""
    )

    if not result:
        logger.warning(f"❌ No data extracted for {project_id}")
        return None

    # Attach the project ID
    result["project_id"] = project_id
    result["url"] = url
    result["scraped_at"] = __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc
    ).isoformat()

    # Log result quality
    has_desc = bool(result.get("description"))
    has_meth = bool(result.get("methodology_name"))
    desc_len = len(result.get("description") or "")
    meth = result.get("methodology_name", "")
    logger.debug(
        f"  VCS-{project_id}: desc={'✅' if has_desc else '❌'} ({desc_len}c) "
        f"meth={'✅ ' + meth if has_meth else '❌'}"
    )

    return result
