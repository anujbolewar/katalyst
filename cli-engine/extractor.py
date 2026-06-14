#!/usr/bin/env python3
"""
Katalyst Extractor — Web & Document Content Extraction
=======================================================
Converts web pages and PDF documents into clean, semantic Markdown
suitable for LLM consumption. Designed as a CLI tool for AI agents.

Usage:
  python extractor.py <url_or_file_path>
  python extractor.py <url_or_file_path> --selector "#main-content"
  python extractor.py <url_or_file_path> --raw       (skip markdown conversion)
"""

import argparse
import sys
import re
import os

# ─── Web Scraping ──────────────────────────────────────────────────────────

def fetch_html(url: str) -> str:
    """Fetch a URL with browser-like headers to avoid bot blocking."""
    import requests

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    resp = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
    resp.raise_for_status()

    # Respect encoding hints
    if resp.encoding and resp.encoding.lower() != "utf-8":
        resp.encoding = resp.apparent_encoding or resp.encoding
    return resp.text


def extract_main_content(html: str, selector: str | None = None) -> str:
    """Strip nav, footer, scripts, styles, and extract the meaningful body."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")

    if selector:
        target = soup.select_one(selector)
        if target:
            return str(target)
        print(f"[extractor] Selector '{selector}' matched nothing — falling back to auto-extract",
              file=sys.stderr)

    # Remove boilerplate elements
    for tag in soup.find_all(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()

    for tag in soup.find_all(["nav", "footer", "header", "aside"]):
        tag.decompose()

    # Remove common ad/sidebar containers
    for cls in ["sidebar", "advertisement", "ad-container", "cookie-banner", "popup"]:
        for tag in soup.find_all(class_=re.compile(cls, re.I)):
            tag.decompose()

    # Try semantic elements first
    for candidate in ["article", "main", '[role="main"]']:
        tag = soup.select_one(candidate)
        if tag:
            return str(tag)

    # Fallback: body content
    body = soup.find("body")
    if body:
        return str(body)

    return str(soup)


def html_to_markdown(html: str) -> str:
    """Convert HTML to clean Markdown using markdownify."""
    from markdownify import markdownify as md_convert

    text = md_convert(
        html,
        heading_style="ATX",       # # Heading 1
        bullets="-",
        strip=["img", "video"],
    )
    return text.strip()


def clean_markdown(text: str) -> str:
    """Post-process Markdown: collapse blank lines, strip link cruft."""
    # Collapse 3+ blank lines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip leading/trailing whitespace per line
    lines = [line.rstrip() for line in text.split("\n")]
    # Remove completely empty leading/trailing lines
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


# ─── PDF Parsing ───────────────────────────────────────────────────────────

def extract_pdf_text(filepath: str) -> str:
    """Extract text from a PDF file page by page."""
    from PyPDF2 import PdfReader

    reader = PdfReader(filepath)
    pages: list[str] = []
    total = len(reader.pages)

    for i, page in enumerate(reader.pages, 1):
        text = page.extract_text()
        if text and text.strip():
            pages.append(f"## Page {i}\n\n{text.strip()}")

    if not pages:
        return "_No extractable text found in this PDF._"

    return f"# PDF: {os.path.basename(filepath)} ({total} pages)\n\n" + "\n\n".join(pages)


# ─── Main CLI ──────────────────────────────────────────────────────────────

def is_url(target: str) -> bool:
    return target.startswith(("http://", "https://"))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Katalyst Extractor — convert web pages and PDFs to clean Markdown",
    )
    parser.add_argument(
        "target",
        help="URL or local file path (.pdf)",
    )
    parser.add_argument(
        "--selector",
        default=None,
        help="CSS selector to target a specific element (web only)",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Output raw HTML text without Markdown conversion",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=100_000,
        help="Maximum output characters (default: 100000)",
    )
    args = parser.parse_args()

    target: str = args.target
    selector: str | None = args.selector
    raw: bool = args.raw
    max_chars: int = args.max_chars

    try:
        if is_url(target):
            print(f"[extractor] Fetching {target}...", file=sys.stderr)
            html = fetch_html(target)
            print(f"[extractor] Received {len(html)} bytes of HTML", file=sys.stderr)

            content_html = extract_main_content(html, selector)
            print(f"[extractor] Extracted {len(content_html)} bytes of main content", file=sys.stderr)

            if raw:
                output = content_html
            else:
                output = html_to_markdown(content_html)
                output = clean_markdown(output)
        else:
            # File: determine type by extension
            ext = os.path.splitext(target)[1].lower()
            if ext == ".pdf":
                print(f"[extractor] Parsing PDF: {target}", file=sys.stderr)
                output = extract_pdf_text(target)
            else:
                # Treat as HTML file
                with open(target, "r", encoding="utf-8", errors="replace") as f:
                    html = f.read()
                content_html = extract_main_content(html, selector)
                if raw:
                    output = content_html
                else:
                    output = html_to_markdown(content_html)
                    output = clean_markdown(output)

        # Truncate if needed
        if len(output) > max_chars:
            output = output[:max_chars] + f"\n\n_[Truncated at {max_chars} characters...]_"

        print(output)

    except Exception as err:
        print(f"Error: {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
