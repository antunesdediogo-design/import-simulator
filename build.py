#!/usr/bin/env python3
"""Assemble index.html from src/.

    python3 build.py           -> index.html (published page, with Firebase shared mode)
    python3 build.py --local   -> dist/local.html (no Firebase tags or config: local mode, for offline tests)

The JS files are concatenated, in the order of JS_FILES, inside one IIFE, so they share
one scope exactly as the original single <script> did. Order matters: top-level statements
(var initialisers, addEventListener calls) run in this order.
Python 3, standard library only.
"""
import datetime
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')

JS_FILES = [
    'core.js',           # pure calculations
    'util.js',           # $, ask/toast/closeModal, esc and number formatters, uid, COLORS
    'state.js',          # defaults, normalisers, load/save, status, S, cur(), recompute()
    'form.js',           # SPEC, sidebar form, product list
    'views.js',          # TABS, KPIs, tab bar
    'view-overview.js',
    'view-cost.js',
    'view-pl.js',
    'view-channels.js',
    'view-ship.js',
    'whatif.js',         # what-if grid and scenarios (pure)
    'view-whatif.js',
    'render.js',         # renderView(), refresh(), changed()
    'events.js',         # form/list/tab/view events, product buttons, export/import
    'ui.js',             # menu, modal buttons, Escape key, theme
    'ideas.js',          # ideas view
    'photos.js',         # photos and lightbox
    'sync.js',           # Firebase shared mode and login gate
    'main.js',           # startup calls
]

IIFE_OPEN = "(function () {\n  'use strict';\n\n"
IIFE_CLOSE = "})();\n"


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def git_hash():
    try:
        out = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT,
                             capture_output=True, text=True, timeout=10)
        return out.stdout.strip() if out.returncode == 0 else ''
    except Exception:
        return ''


def stamp():
    s = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    h = git_hash()
    return s + (' ' + h if h else '')


def script():
    return IIFE_OPEN + ''.join(read(n) for n in JS_FILES) + IIFE_CLOSE


def build(local):
    head = read('head.html')
    anchor = '<meta charset="utf-8">\n'
    if anchor not in head:
        sys.exit('build.py: <meta charset="utf-8"> not found in src/head.html')
    head = head.replace(anchor, anchor + '<meta name="build" content="' + stamp() + '">\n', 1)
    parts = [
        head,
        '<style>\n', read('styles.css'), '</style>\n</head>\n<body>\n',
        read('body.html'),
        '' if local else read('firebase-config.html'),
        '<script>\n', script(), '</script>\n</body>\n</html>\n',
    ]
    return ''.join(parts)


def main():
    local = '--local' in sys.argv[1:]
    out = os.path.join(ROOT, 'dist', 'local.html') if local else os.path.join(ROOT, 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(build(local))
    print('wrote', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    main()
