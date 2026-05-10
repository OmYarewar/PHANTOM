#!/usr/bin/env python3
"""
PHANTOM — Scrapling Integration Bridge
Uses Scrapling (https://github.com/D4Vinci/Scrapling) for advanced web scraping.
Supports: Fetcher (fast HTTP), StealthyFetcher (anti-bot bypass), DynamicFetcher (full browser)
"""
import sys
import json
import argparse

def fetch_basic(url, css_selector=None, xpath=None, headers=None, proxy=None):
    """Fast HTTP fetch with TLS fingerprint impersonation"""
    from scrapling.fetchers import Fetcher
    kwargs = {'stealthy_headers': True}
    if proxy:
        kwargs['proxy'] = proxy
    page = Fetcher.get(url, **kwargs)
    return extract(page, css_selector, xpath)

def fetch_stealth(url, css_selector=None, xpath=None, solve_cloudflare=True, proxy=None):
    """Stealth fetch — bypasses anti-bot systems like Cloudflare"""
    from scrapling.fetchers import StealthyFetcher
    kwargs = {'headless': True, 'google_search': False}
    if solve_cloudflare:
        kwargs['solve_cloudflare'] = True
    if proxy:
        kwargs['proxy'] = proxy
    page = StealthyFetcher.fetch(url, **kwargs)
    return extract(page, css_selector, xpath)

def fetch_dynamic(url, css_selector=None, xpath=None, wait_selector=None, proxy=None):
    """Dynamic fetch — full browser rendering with Playwright"""
    from scrapling.fetchers import DynamicFetcher
    kwargs = {'headless': True, 'network_idle': True}
    if proxy:
        kwargs['proxy'] = proxy
    page = DynamicFetcher.fetch(url, **kwargs)
    return extract(page, css_selector, xpath)

def extract(page, css_selector=None, xpath=None):
    """Extract data from the page using CSS/XPath or return full text"""
    result = {
        'url': str(getattr(page, 'url', '')),
        'status': getattr(page, 'status', 200),
    }

    if css_selector:
        elements = page.css(css_selector)
        result['selector'] = css_selector
        result['count'] = len(elements)
        result['data'] = []
        for el in elements[:50]:  # Cap at 50 elements
            item = {
                'text': el.text.strip() if hasattr(el, 'text') and el.text else '',
                'html': str(el)[:500],
            }
            # Get common attributes
            for attr in ['href', 'src', 'class', 'id', 'title', 'alt']:
                val = el.attrib.get(attr)
                if val:
                    item[attr] = val
            result['data'].append(item)
    elif xpath:
        elements = page.xpath(xpath)
        result['selector'] = xpath
        if isinstance(elements, list):
            result['count'] = len(elements)
            result['data'] = []
            for el in elements[:50]:
                if isinstance(el, str):
                    result['data'].append({'text': el})
                else:
                    item = {'text': el.text.strip() if hasattr(el, 'text') and el.text else ''}
                    result['data'].append(item)
        else:
            result['data'] = [{'text': str(elements)}]
    else:
        # Return full page text content
        text = page.get_all_text() if hasattr(page, 'get_all_text') else ''
        if not text and hasattr(page, 'css'):
            body = page.css('body')
            if body:
                text = body[0].text if hasattr(body[0], 'text') else str(body[0])
        result['text'] = text[:15000] if text else ''
        # Also grab title and meta
        title = page.css('title::text')
        if title:
            result['title'] = title.get() if hasattr(title, 'get') else str(title[0]) if title else ''
        meta_desc = page.css('meta[name="description"]')
        if meta_desc:
            result['meta_description'] = meta_desc[0].attrib.get('content', '') if meta_desc else ''
        # Get all links
        links = page.css('a[href]')
        if links:
            result['links'] = [{'href': a.attrib.get('href', ''), 'text': (a.text or '').strip()} for a in links[:30]]

    return result


def main():
    parser = argparse.ArgumentParser(description='PHANTOM Scrapling Bridge')
    parser.add_argument('url', help='URL to scrape')
    parser.add_argument('--mode', choices=['basic', 'stealth', 'dynamic'], default='basic',
                        help='Fetcher mode: basic (fast HTTP), stealth (anti-bot), dynamic (full browser)')
    parser.add_argument('--css', default=None, help='CSS selector to extract')
    parser.add_argument('--xpath', default=None, help='XPath selector to extract')
    parser.add_argument('--proxy', default=None, help='Proxy URL')
    parser.add_argument('--no-cloudflare', action='store_true', help='Disable Cloudflare solving in stealth mode')

    args = parser.parse_args()

    try:
        if args.mode == 'stealth':
            result = fetch_stealth(args.url, args.css, args.xpath,
                                   solve_cloudflare=not args.no_cloudflare, proxy=args.proxy)
        elif args.mode == 'dynamic':
            result = fetch_dynamic(args.url, args.css, args.xpath, proxy=args.proxy)
        else:
            result = fetch_basic(args.url, args.css, args.xpath, proxy=args.proxy)

        print(json.dumps(result, indent=2, default=str, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({'error': str(e), 'type': type(e).__name__}, indent=2))
        sys.exit(1)


if __name__ == '__main__':
    main()
