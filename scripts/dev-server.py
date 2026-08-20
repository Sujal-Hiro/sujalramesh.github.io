#!/usr/bin/env python3
"""Local dev server that refuses to let the browser cache anything.

Why this exists rather than `python -m http.server`:

The site is plain ES modules with no bundler, so filenames never change
between builds. `http.server` sends Last-Modified and no Cache-Control,
which makes browsers cache heuristically - and a cached module is far
worse than a cached image. If main.js is fresh but the scroll.js it
imports is stale, the import fails on a missing export, the whole module
graph dies, and the page renders as unstyled half-invisible text with no
obvious cause.

That cost hours once. It will not again: every response here is
no-store, so a plain reload is always a true reload.

    python scripts/dev-server.py [port]

This is a development tool only. GitHub Pages serves the real site and
sets its own (correct) caching headers.
"""

import sys
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    # Correct types for the files this site actually serves. Windows
    # reads MIME types from the registry, where .js and .mjs are
    # routinely wrong - and a module served as text/plain is rejected
    # outright by every browser.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.gltf': 'model/gltf+json',
        '.bin': 'application/octet-stream',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.svg': 'image/svg+xml',
    }

    def log_message(self, fmt, *args):
        # Keep 404s, drop the successful-request noise.
        if args and len(args) > 1 and str(args[1]).startswith('2'):
            return
        super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=ROOT)
    server = ThreadingHTTPServer(('127.0.0.1', port), handler)
    print(f'serving {ROOT}')
    print(f'  http://localhost:{port}   (caching disabled)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == '__main__':
    main()
