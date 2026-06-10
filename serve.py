#!/usr/bin/env python3
"""Zero-config HTTP server for Earth Love United ELU engine.
   Serves from the repo root so all relative paths resolve correctly.
   Usage: python3 serve.py [port]
"""
import http.server
import socketserver
import socket
import sys
import os
import webbrowser
import time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

os.chdir(os.path.dirname(os.path.abspath(__file__)))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, format, *args):
        pass

with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    httpd.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    print(f"\n   🌍 Earth Love United Server")
    print(f"   ─────────────────────────────")
    print(f"   Local:  http://localhost:{PORT}")
    print(f"   ─────────────────────────────")
    print(f"   Serving from: {os.getcwd()}\n")
    httpd.serve_forever()