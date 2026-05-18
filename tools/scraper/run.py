#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════════
  CARBON REGISTRY SCRAPER — CLI Entrypoint
  
  A standalone tool that scrapes carbon registry detail pages using
  LightPanda CDP + Playwright. Built for Hermes (Earth Love United).
  
  Commands:
    python run.py verra-details              # Scrape all Verra descriptions
    python run.py verra-details --test-one   # Test single page (recon)
    python run.py gs-methodologies           # Enrich GS methodology nulls
    python run.py status                     # Show checkpoint progress
    
  Output: JSONL files in data/scraped/ for Hermes to merge.
═══════════════════════════════════════════════════════════════════════════
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

import click
import yaml

# Ensure local imports work
ROOT = Path(__file__).parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-20s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("scraper.cli")


def load_config() -> dict:
    """Load config.yaml."""
    config_path = ROOT / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f) or {}


@click.group()
def cli():
    """🌍 Carbon Registry Scraper — LightPanda-powered detail page extraction."""
    pass


# ─── VERRA DETAILS ──────────────────────────────────────────────

@cli.command("verra-details")
@click.option("--test-one", is_flag=True, help="Test single page (recon mode)")
@click.option("--test-id", default="191", help="Project ID for test mode")
@click.option("--concurrency", "-c", default=None, type=int, help="Override concurrency")
@click.option("--lightpanda", is_flag=True, help="Use LightPanda instead of Chromium (only for static pages)")
@click.option("--limit", "-n", default=None, type=int, help="Limit number of URLs to process")
def verra_details(test_one, test_id, concurrency, lightpanda, limit):
    """Scrape Verra project detail pages for descriptions."""
    asyncio.run(_verra_details(test_one, test_id, concurrency, lightpanda, limit))


async def _verra_details(test_one, test_id, concurrency, lightpanda, limit):
    from verra_details import (
        extract_verra_detail,
        build_verra_urls,
        build_verra_urls_needing_descriptions,
        VERRA_DETAIL_URL,
    )
    from batch_runner import BatchRunner
    from browser import BrowserManager

    config = load_config()
    paths = config.get("paths", {})
    raw_path = ROOT / paths.get("verra_raw", "../carbon-projects/raw/verra_projects.jsonl")
    output_path = ROOT / paths.get("verra_details_output", "./data/scraped/verra_details.jsonl")
    checkpoint_path = ROOT / paths.get("verra_checkpoint", "./data/checkpoints/verra_details.json")
    # Default to Chromium — LightPanda can't render Angular SPAs
    browser_mode = "lightpanda" if lightpanda else "chromium"

    if test_one:
        # ─── Recon Mode: test single page ───
        url = VERRA_DETAIL_URL.format(project_id=test_id)
        click.echo(f"🔬 RECON MODE — Testing: {url}")
        click.echo(f"   Browser: {browser_mode}")

        async with BrowserManager(config, mode=browser_mode) as bm:
            async with bm.new_page() as page:
                click.echo("   Navigating...")
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                status = resp.status if resp else "?"
                click.echo(f"   HTTP {status}")

                # Wait for render
                await page.wait_for_timeout(2000)

                # Get page title
                title = await page.title()
                click.echo(f"   Title: {title}")

                # Run extractor
                result = await extract_verra_detail(page, url)

                if result:
                    click.echo(f"\n{'═' * 60}")
                    click.echo("   EXTRACTION RESULT:")
                    click.echo(f"{'═' * 60}")
                    
                    desc = result.get("description")
                    if desc:
                        click.echo(f"   📝 Description: {desc[:200]}...")
                        click.echo(f"      Length: {len(desc)} chars")
                    else:
                        click.echo("   ❌ No description found")

                    meth = result.get("methodology_name")
                    if meth:
                        click.echo(f"   🔬 Methodology: {meth}")
                    else:
                        click.echo("   ❌ No methodology found")

                    credits = result.get("credits_issued")
                    if credits:
                        click.echo(f"   💳 Credits issued: {credits:,}")

                    sdgs = result.get("sdgs")
                    if sdgs:
                        click.echo(f"   🎯 SDGs: {sdgs}")

                    raw = result.get("raw_text", "")
                    if raw:
                        click.echo(f"\n   📄 Raw text preview (first 500c):")
                        click.echo(f"   {raw[:500]}")

                    click.echo(f"\n   Full result:")
                    # Don't print raw_text in full output (too noisy)
                    display = {k: v for k, v in result.items() if k != "raw_text"}
                    click.echo(json.dumps(display, indent=2, ensure_ascii=False))
                else:
                    click.echo("   ❌ Extraction returned None")
                    # Dump page content for debugging
                    content = await page.content()
                    click.echo(f"\n   Page HTML length: {len(content)} chars")
                    click.echo(f"   First 500 chars of body:")
                    text = await page.evaluate("() => document.body?.innerText?.substring(0, 500)")
                    click.echo(f"   {text}")
        return

    # ─── Batch Mode ───
    if not raw_path.exists():
        click.echo(f"❌ Verra raw data not found: {raw_path}", err=True)
        click.echo("   Run Hermes's verra_scraper.py first.", err=True)
        sys.exit(1)

    projects = build_verra_urls_needing_descriptions(
        str(raw_path), str(output_path)
    )

    if not projects:
        click.echo("✅ All Verra projects already have descriptions!")
        return

    urls = [p["url"] for p in projects]
    if limit:
        urls = urls[:limit]
        click.echo(f"🔒 Limited to {limit} URLs")

    batch_concurrency = concurrency or config.get("batch", {}).get("concurrency", 5)

    click.echo(f"\n{'═' * 60}")
    click.echo(f"  VERRA DETAIL SCRAPER")
    click.echo(f"  URLs: {len(urls)} | Concurrency: {batch_concurrency}")
    click.echo(f"  Browser: {browser_mode}")
    click.echo(f"  Output: {output_path}")
    click.echo(f"  Checkpoint: {checkpoint_path}")
    click.echo(f"{'═' * 60}\n")

    runner = BatchRunner(
        urls=urls,
        extractor_fn=extract_verra_detail,
        output_path=str(output_path),
        checkpoint_path=str(checkpoint_path),
        config=config,
        concurrency=batch_concurrency,
        browser_mode=browser_mode,
    )

    await runner.run()


# ─── GOLD STANDARD METHODOLOGIES ────────────────────────────────

@cli.command("gs-methodologies")
@click.option("--phase-a", is_flag=True, help="Only run Phase A (POA parent inheritance)")
@click.option("--phase-b", is_flag=True, help="Only run Phase B (API detail sweep)")
@click.option("--phase-c", is_flag=True, help="Only run Phase C (type-based inference)")
@click.option("--phase-d", is_flag=True, help="Only run Phase D (Berkeley VROD cross-ref)")
@click.option("--delay", default=0.3, type=float, help="Delay between API calls (sec)")
@click.option("--min-confidence", default=0.70, type=float, help="Min confidence for type inference")
def gs_methodologies(phase_a, phase_b, phase_c, phase_d, delay, min_confidence):
    """Enrich Gold Standard projects with missing methodologies.
    
    Four-phase resolution:
      Phase A: POA parent inheritance (highest fidelity)
      Phase B: API detail sweep (catch DB updates)
      Phase C: Type-based inference (tagged, ≥70% confidence)
      Phase D: Berkeley VROD cross-reference (UC Berkeley research DB)
    
    If no phase flag is specified, runs all phases (except B which is slow).
    """
    asyncio.run(_gs_methodologies(phase_a, phase_b, phase_c, phase_d, delay, min_confidence))


async def _gs_methodologies(phase_a, phase_b, phase_c, phase_d, delay, min_confidence):
    from gs_methodology_enricher import (
        load_all_gs_projects,
        find_gs_projects_needing_methodology,
        resolve_via_poa_parent,
        resolve_via_api,
        resolve_via_type_inference,
        resolve_via_berkeley_vrod,
        summary,
    )

    config = load_config()
    paths = config.get("paths", {})
    raw_path = ROOT / paths.get("gs_raw", "../../carbon-projects/raw/gold_standard_projects.jsonl")
    output_path = ROOT / paths.get("gs_enrichment_output", "./data/scraped/gs_methodology_enrichment.jsonl")
    berkeley_path = ROOT / "data" / "external" / "berkeley_vrod_2026-02.xlsx"

    if not raw_path.exists():
        click.echo(f"❌ GS raw data not found: {raw_path}", err=True)
        sys.exit(1)

    # Run all phases if no specific phase selected (B excluded — slow)
    run_all = not (phase_a or phase_b or phase_c or phase_d)

    all_projects = load_all_gs_projects(str(raw_path))
    null_projects = find_gs_projects_needing_methodology(str(raw_path))

    if not null_projects:
        click.echo("✅ All GS projects already have methodologies!")
        return

    click.echo(f"\n{'═' * 60}")
    click.echo(f"  GOLD STANDARD METHODOLOGY ENRICHER")
    click.echo(f"  Projects needing methodology: {len(null_projects)}")
    click.echo(f"  Total projects: {len(all_projects)}")
    click.echo(f"  Output: {output_path}")
    click.echo(f"{'═' * 60}\n")

    # ── Phase A: POA Parent Inheritance ──
    if run_all or phase_a:
        click.echo("🔗 Phase A: POA Parent Inheritance...")
        stats_a = resolve_via_poa_parent(null_projects, all_projects, str(output_path))
        click.echo(f"   Resolved: {stats_a['resolved']} | Parent null: {stats_a['parent_also_null']} | Not VPA: {stats_a['not_vpa']}")

    # ── Phase B: API Detail Sweep ──
    if run_all or phase_b:
        click.echo("\n📡 Phase B: API Detail Sweep...")
        stats_b = await resolve_via_api(null_projects, str(output_path), delay=delay)
        click.echo(f"   Queried: {stats_b['queried']} | Found: {stats_b['found']} | Not found: {stats_b['not_found']}")

    # ── Phase C: Type-Based Inference ──
    if run_all or phase_c:
        click.echo(f"\n🧠 Phase C: Type-Based Inference (≥{min_confidence*100:.0f}% confidence)...")
        stats_c = resolve_via_type_inference(null_projects, all_projects, str(output_path), min_confidence)
        click.echo(f"   Inferred: {stats_c['inferred']} | Below threshold: {stats_c['below_threshold']}")

    # ── Phase D: Berkeley VROD Cross-Reference ──
    if run_all or phase_d:
        if berkeley_path.exists():
            click.echo("\n📚 Phase D: Berkeley VROD Cross-Reference...")
            stats_d = resolve_via_berkeley_vrod(null_projects, str(berkeley_path), str(output_path))
            click.echo(f"   Resolved: {stats_d['resolved']} | Not found: {stats_d['not_found']}")
        else:
            click.echo(f"\n⚠️  Phase D: Berkeley VROD not found at {berkeley_path}")
            click.echo("   Download: https://gspp.berkeley.edu/berkeley-carbon-trading-project/offsets-database")

    # ── Summary ──
    s = summary(str(output_path))
    click.echo(f"\n{'═' * 60}")
    click.echo(f"  ENRICHMENT COMPLETE")
    click.echo(f"  Total resolved: {s['total']} / {len(null_projects)} ({s['total']/len(null_projects)*100:.1f}%)")
    if "by_source" in s:
        for source, count in sorted(s["by_source"].items()):
            click.echo(f"    {source}: {count}")
    click.echo(f"  Remaining gap: {len(null_projects) - s['total']}")
    click.echo(f"{'═' * 60}")


# ─── INGEST EXTERNAL SOURCES ────────────────────────────────────

@cli.command("ingest-external")
def ingest_external():
    """Ingest external databases (CarbonPlan OffsetsDB) into Hermes-compatible JSONL.
    
    Extracts ACR, CAR, CERCARBONO, Isometric, and ART TREES projects
    from the downloaded CarbonPlan OffsetsDB CSV.
    """
    from ingest_external import ingest_carbonplan, ingest_credits

    cp_csv = ROOT / "data" / "external" / "carbonplan" / "projects.csv"
    cp_credits = ROOT / "data" / "external" / "carbonplan" / "credits.csv"
    output_dir = ROOT / "data" / "scraped"

    if not cp_csv.exists():
        click.echo(f"❌ CarbonPlan projects.csv not found: {cp_csv}", err=True)
        click.echo("   Download from: https://carbonplan-offsets-db.s3.us-west-2.amazonaws.com/production/latest/offsets-db.csv.zip")
        return

    click.echo(f"\n{'═' * 60}")
    click.echo(f"  EXTERNAL DATA INGESTOR")
    click.echo(f"{'═' * 60}\n")

    # Ingest projects
    click.echo("📦 Ingesting CarbonPlan projects...")
    stats = ingest_carbonplan(str(cp_csv), str(output_dir))
    for reg, count in sorted(stats.items()):
        click.echo(f"   {reg}: {count} projects")
    
    total = sum(stats.values())
    click.echo(f"\n   Total new projects: {total}")

    # Ingest credits
    if cp_credits.exists():
        click.echo("\n💳 Ingesting CarbonPlan credit transactions...")
        credit_stats = ingest_credits(
            str(cp_credits),
            str(output_dir / "external_credits.jsonl"),
        )
        click.echo(f"   Credit transactions: {credit_stats['total_credits']}")

    click.echo(f"\n{'═' * 60}")
    click.echo(f"  INGEST COMPLETE — {total} projects from {len(stats)} registries")
    click.echo(f"{'═' * 60}")


# ─── STATUS ─────────────────────────────────────────────────────


@cli.command("status")
def status():
    """Show scraping progress from checkpoints."""
    config = load_config()
    paths = config.get("paths", {})

    click.echo(f"\n{'═' * 60}")
    click.echo(f"  SCRAPER STATUS")
    click.echo(f"{'═' * 60}\n")

    # Verra checkpoint
    verra_cp = ROOT / paths.get("verra_checkpoint", "./data/checkpoints/verra_details.json")
    if verra_cp.exists():
        with open(verra_cp) as f:
            cp = json.load(f)
        total = len(cp)
        done = sum(1 for v in cp.values() if v == "done")
        errors = sum(1 for v in cp.values() if v.startswith("error"))
        empty = sum(1 for v in cp.values() if v == "empty")
        click.echo(f"  📋 Verra Details:")
        click.echo(f"     Total: {total} | Done: {done} | Empty: {empty} | Errors: {errors}")
        click.echo(f"     Progress: {done/max(total,1)*100:.1f}%")
    else:
        click.echo("  📋 Verra Details: No checkpoint found")

    # GS enrichment output
    gs_out = ROOT / paths.get("gs_enrichment_output", "./data/scraped/gs_methodology_enrichment.jsonl")
    if gs_out.exists():
        with open(gs_out) as f:
            count = sum(1 for _ in f)
        click.echo(f"\n  📋 GS Methodologies:")
        click.echo(f"     Enriched: {count} projects")
    else:
        click.echo("\n  📋 GS Methodologies: No output found")

    # Output files
    scraped_dir = ROOT / "data" / "scraped"
    if scraped_dir.exists():
        click.echo(f"\n  📁 Output files:")
        for f in sorted(scraped_dir.iterdir()):
            if f.is_file():
                size = f.stat().st_size
                lines = sum(1 for _ in open(f)) if f.suffix == ".jsonl" else "N/A"
                click.echo(f"     {f.name}: {size/1024:.1f}KB, {lines} records")

    click.echo()


if __name__ == "__main__":
    cli()
