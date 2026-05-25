#!/usr/bin/env python3
"""
Agent-Browser Bridge — WebSocket message router.

Two WS endpoints:
  ws://localhost:8765  Browser clients (UI)
  ws://localhost:8766  Autonomous agents (backend)

Protocol (JSON frames):
  Browser -> Bridge:
    {"type": "subscribe", "channel": "globe"}
    {"type": "publish",   "channel": "chat", "payload": {"msg": "hello"}}

  Agent -> Bridge:
    {"action": "updateGlobe", "data": [...]}          # broadcast to all browsers
    {"action": "sendTo",      "clientId": "...", ...} # target a specific browser
    {"action": "broadcast",   "payload": {...}}       # broadcast to all browsers
    {"action": "ping"}                                 # health check

  Bridge -> Browser:
    {"source": "bridge", "action": "updateGlobe", "data": [...]}
    {"source": "bridge", "type": "pong"}
    {"source": "bridge", "type": "subscribed", "clientId": "..."}

  Bridge -> Agent:
    {"status": "ok", "connectedBrowsers": 3, "message": "broadcast sent"}
    {"status": "error", "message": "..."}
    {"source": "browser", "type": "publish", "channel": "globe", "payload": {...}}
    {"source": "browser", "type": "subscribe", "channel": "globe"}

Usage:
  python bridge.py
  python bridge.py --browser-port 8765 --agent-port 8766 --host 0.0.0.0
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import signal
import sys
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import websockets
from websockets.server import WebSocketServerProtocol

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bridge")

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Client:
    ws: WebSocketServerProtocol
    client_id: str
    client_type: str  # "browser" or "agent"
    connected_at: float = field(default_factory=time.time)
    channels: set[str] = field(default_factory=set)


# ---------------------------------------------------------------------------
# Connection registry
# ---------------------------------------------------------------------------

class Registry:
    """Thread-safe (single-event-loop safe) connection store."""

    def __init__(self) -> None:
        self._clients: dict[str, Client] = {}

    # -- mutators -----------------------------------------------------------

    def add(self, client: Client) -> None:
        self._clients[client.client_id] = client
        log.info(
            "connected  %s [%s]  (total=%d)",
            client.client_id,
            client.client_type,
            len(self._clients),
        )

    def remove(self, client_id: str) -> Client | None:
        client = self._clients.pop(client_id, None)
        if client:
            log.info(
                "disconnected  %s [%s]  (total=%d)",
                client.client_id,
                client.client_type,
                len(self._clients),
            )
        return client

    # -- queries ------------------------------------------------------------

    def get(self, client_id: str) -> Client | None:
        return self._clients.get(client_id)

    @property
    def browsers(self) -> list[Client]:
        return [c for c in self._clients.values() if c.client_type == "browser"]

    @property
    def agents(self) -> list[Client]:
        return [c for c in self._clients.values() if c.client_type == "agent"]

    @property
    def all(self) -> list[Client]:
        return list(self._clients.values())

    def snapshot(self) -> dict[str, int]:
        return {
            "total": len(self._clients),
            "browsers": len(self.browsers),
            "agents": len(self.agents),
        }


# ---------------------------------------------------------------------------
# Message router
# ---------------------------------------------------------------------------

class Bridge:
    def __init__(self, browser_port: int, agent_port: int, host: str) -> None:
        self.host = host
        self.browser_port = browser_port
        self.agent_port = agent_port
        self.registry = Registry()
        self._shutdown_event = asyncio.Event()

    # -- helpers ------------------------------------------------------------

    @staticmethod
    def _make_id(client_type: str) -> str:
        return f"{client_type}-{uuid.uuid4().hex[:8]}"

    async def _send(self, client: Client, payload: dict[str, Any]) -> bool:
        try:
            await client.ws.send(json.dumps(payload))
            return True
        except websockets.exceptions.ConnectionClosed:
            return False

    async def _broadcast(
        self,
        payload: dict[str, Any],
        *,
        include: list[Client] | None = None,
        exclude: str | None = None,
    ) -> int:
        """Send payload to all browsers (or a filtered list). Returns count."""
        targets = include if include is not None else self.registry.browsers
        sent = 0
        for client in targets:
            if exclude and client.client_id == exclude:
                continue
            if await self._send(client, payload):
                sent += 1
        return sent

    # -- inbound handlers ---------------------------------------------------

    async def _on_agent_message(self, client: Client, raw: str) -> None:
        """Route a message from an agent client to browser clients."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await self._send(client, {"status": "error", "message": "invalid JSON"})
            return

        action = msg.get("action", "")

        if action == "ping":
            snap = self.registry.snapshot()
            await self._send(client, {"status": "ok", **snap})
            return

        if action == "updateGlobe":
            data = msg.get("data", [])
            payload = {"source": "bridge", "action": "updateGlobe", "data": data}
            n = await self._broadcast(payload)
            await self._send(client, {
                "status": "ok",
                "message": f"broadcast to {n} browser(s)",
                "receivers": n,
            })
            return

        if action == "broadcast":
            payload = {"source": "bridge", **msg.get("payload", {})}
            n = await self._broadcast(payload)
            await self._send(client, {
                "status": "ok",
                "message": f"broadcast to {n} browser(s)",
                "receivers": n,
            })
            return

        if action == "sendTo":
            target_id = msg.get("clientId")
            target = self.registry.get(target_id) if target_id else None
            if not target or target.client_type != "browser":
                await self._send(client, {
                    "status": "error",
                    "message": f"browser client '{target_id}' not found",
                })
                return
            payload = {"source": "agent", **msg.get("payload", {"action": action})}
            ok = await self._send(target, payload)
            await self._send(client, {
                "status": "ok" if ok else "error",
                "message": "delivered" if ok else "delivery failed",
            })
            return

        if action == "listClients":
            clients = [
                {"id": c.client_id, "type": c.client_type, "channels": list(c.channels)}
                for c in self.registry.all
            ]
            await self._send(client, {"status": "ok", "clients": clients})
            return

        # unknown action — echo back
        await self._send(client, {"status": "ok", "echo": msg})

    async def _on_browser_message(self, client: Client, raw: str) -> None:
        """Handle messages from a browser client (subscriptions, publishes)."""
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await self._send(client, {"source": "bridge", "type": "error", "message": "invalid JSON"})
            return

        msg_type = msg.get("type", "")

        if msg_type == "subscribe":
            channel = msg.get("channel", "default")
            client.channels.add(channel)
            await self._send(client, {
                "source": "bridge",
                "type": "subscribed",
                "clientId": client.client_id,
                "channel": channel,
            })
            return

        if msg_type == "publish":
            channel = msg.get("channel", "default")
            payload = msg.get("payload", {})
            # Forward to agents on the same channel
            routed = {"source": "browser", "type": "publish", "channel": channel, "payload": payload}
            for agent in self.registry.agents:
                if channel in agent.channels or not agent.channels:
                    await self._send(agent, routed)
            # Echo to sender
            await self._send(client, {"source": "bridge", "type": "ack"})
            return

        # health / heartbeat
        if msg_type == "ping":
            await self._send(client, {"source": "bridge", "type": "pong"})
            return

        # unknown — echo
        await self._send(client, {"source": "bridge", "type": "echo", "data": msg})

    # -- connection lifecycle -----------------------------------------------

    async def _browser_handler(self, ws: WebSocketServerProtocol) -> None:
        cid = self._make_id("browser")
        client = Client(ws=ws, client_id=cid, client_type="browser")
        self.registry.add(client)
        try:
            async for raw in ws:
                await self._on_browser_message(client, raw)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.registry.remove(cid)

    async def _agent_handler(self, ws: WebSocketServerProtocol) -> None:
        cid = self._make_id("agent")
        client = Client(ws=ws, client_id=cid, client_type="agent")
        self.registry.add(client)
        try:
            async for raw in ws:
                await self._on_agent_message(client, raw)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.registry.remove(cid)

    # -- HTTP health endpoint (served on agent port + 1 via websockets?) -----
    # We skip a full HTTP server — agents use WS ping for health checks.

    # -- main loop ----------------------------------------------------------

    async def _shutdown(self) -> None:
        """Close all connections gracefully."""
        log.info("shutting down …")
        for client in self.registry.all:
            try:
                await client.ws.close(1001, "server shutting down")
            except Exception:
                pass
        self._shutdown_event.set()

    async def run(self) -> None:
        # Signal handling for graceful shutdown loop is handled by serve()
        # context manager, but we also register explicit handlers if the
        # caller passes a running loop.
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self._shutdown()))

        log.info("Bridge starting — browser=%s agent=%s", self.browser_port, self.agent_port)

        async with (
            websockets.serve(
                self._browser_handler,
                self.host,
                self.browser_port,
                ping_interval=20,
                ping_timeout=10,
            ) as browser_server,
            websockets.serve(
                self._agent_handler,
                self.host,
                self.agent_port,
                ping_interval=20,
                ping_timeout=10,
            ) as agent_server,
        ):
            log.info("Browser WS  ws://%s:%d", self.host, self.browser_port)
            log.info("Agent   WS  ws://%s:%d", self.host, self.agent_port)
            log.info("Press Ctrl+C to shut down.")
            await self._shutdown_event.wait()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Agent-Browser WebSocket Bridge")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1)")
    parser.add_argument("--browser-port", type=int, default=8765, help="Browser WS port (default: 8765)")
    parser.add_argument("--agent-port", type=int, default=8766, help="Agent WS port (default: 8766)")
    parser.add_argument("--verbose", "-v", action="store_true", help="DEBUG-level logging")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    bridge = Bridge(
        browser_port=args.browser_port,
        agent_port=args.agent_port,
        host=args.host,
    )
    asyncio.run(bridge.run())


if __name__ == "__main__":
    main()
