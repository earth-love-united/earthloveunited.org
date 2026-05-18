"""
IGES CDM Database Acquisition — nodriver Cloudflare bypass.
Opens the IGES page, passes CF challenge, downloads the CDM Excel.
"""

import asyncio
import nodriver as uc
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data" / "external"
DATA_DIR.mkdir(parents=True, exist_ok=True)

async def main():
    print("🚀 Launching nodriver for IGES CDM database...")
    
    browser = await uc.start(
        headless=False,
        browser_args=["--window-size=1280,900"],
    )
    
    # Navigate to IGES CDM page
    print("📡 Navigating to IGES CDM database page...")
    page = await browser.get("https://www.iges.or.jp/en/pub/iges-cdm-project-database/en")
    
    # Wait for Cloudflare challenge to resolve
    print("⏳ Waiting for Cloudflare challenge...")
    await asyncio.sleep(10)
    
    # Check if we passed
    html = await page.get_content()
    print(f"📄 Page loaded: {len(html)} bytes")
    
    if "challenge" in html.lower() or len(html) < 2000:
        print("⚠️  Still on challenge page, waiting longer...")
        await asyncio.sleep(15)
        html = await page.get_content()
        print(f"📄 Retry: {len(html)} bytes")
    
    # Save the page HTML for analysis
    debug_path = DATA_DIR / "iges_cdm_page.html"
    with open(debug_path, "w") as f:
        f.write(html)
    print(f"💾 Saved page HTML to {debug_path}")
    
    # Try to find download links
    print("\n🔍 Searching for download links...")
    
    # Method 1: Find all links with 'download' or '.xlsx' or '.zip'
    links = await page.query_selector_all("a[href]")
    download_links = []
    for link in links:
        href = await link.get_js_attribute("href")  
        text = link.text or ""
        if href and any(ext in str(href).lower() for ext in ['.xlsx', '.zip', '.xls', 'download', 'cdm']):
            download_links.append((text.strip()[:60], href))
            print(f"  📎 {text.strip()[:60]} → {href}")
    
    if not download_links:
        # Method 2: Get ALL links
        print("\n  No obvious download links found. Listing all links...")
        for link in links[:30]:
            href = await link.get_js_attribute("href")
            text = link.text or ""
            if href and text.strip():
                print(f"  🔗 {text.strip()[:50]} → {str(href)[:80]}")
    
    # Keep browser open for manual inspection
    print("\n✅ Browser is open — inspect the page manually if needed.")
    print("   Press Ctrl+C to close.")
    
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Closing browser.")
    
    browser.stop()

if __name__ == "__main__":
    asyncio.run(main())
