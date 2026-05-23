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

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    httpd.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # SO_REUSEADDR
    print(f"\n   🌍 Earth Love United Server")
    print(f"   ─────────────────────────────")
    print(f"   Local:  http://localhost:{PORT}")
    print(f"   Module: http://localhost:{PORT}/design/modules/test-harness.html")
    print(f"   ─────────────────────────────")
    print(f"   Serving from: {os.getcwd()}\n")
    try:
        webbrowser.open(f"http://localhost:{PORT}/design/modules/test-harness.html")
    except:
        pass
    httpd.serve_forever()