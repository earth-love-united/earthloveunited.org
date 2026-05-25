#!/usr/bin/env python3
"""Smoke test for the Agent-Browser Bridge."""

import asyncio
import json
import sys

sys.path.insert(0, "/Users/ekmelozdemir/earthloveunited.org/infra")

import websockets

BROWSER_URL = "ws://127.0.0.1:8765"
AGENT_URL = "ws://127.0.0.1:8766"

results: list[str] = []


def report(label: str, ok: bool) -> None:
    status = "OK" if ok else "FAIL"
    results.append(f"  [{status}] {label}")
    print(results[-1])


async def test_agent_ping() -> bool:
    async with websockets.connect(AGENT_URL) as ws:
        await ws.send(json.dumps({"action": "ping"}))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        return resp.get("status") == "ok" and resp.get("total") is not None


async def test_agent_list_clients() -> bool:
    async with websockets.connect(AGENT_URL) as ws:
        await ws.send(json.dumps({"action": "listClients"}))
        resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        return resp.get("status") == "ok" and isinstance(resp.get("clients"), list)


async def test_broadcast() -> bool:
    """Connect a browser client, send broadcast from agent, verify browser receives."""
    async with websockets.connect(BROWSER_URL) as browser:
        # Wait for connection confirmation (browser sends nothing, just connected)
        async with websockets.connect(AGENT_URL) as agent:
            # Agent sends a broadcast payload
            payload = {"action": "broadcast", "payload": {"action": "globePulse", "intensity": 0.7}}
            await agent.send(json.dumps(payload))

            # Browser should receive it
            raw = await asyncio.wait_for(browser.recv(), timeout=3)
            data = json.loads(raw)
            ok = data.get("action") == "globePulse" and data.get("intensity") == 0.7

            # Agent should get ack
            agent_resp = json.loads(await asyncio.wait_for(agent.recv(), timeout=3))
            return ok and agent_resp.get("status") == "ok"


async def test_update_globe() -> bool:
    async with websockets.connect(BROWSER_URL) as browser:
        async with websockets.connect(AGENT_URL) as agent:
            await agent.send(json.dumps({
                "action": "updateGlobe",
                "data": [{"lat": 41.0, "lng": 29.0, "color": "green"}],
            }))
            raw = await asyncio.wait_for(browser.recv(), timeout=3)
            data = json.loads(raw)
            received = (
                data.get("action") == "updateGlobe"
                and isinstance(data.get("data"), list)
            )
            agent_resp = json.loads(await asyncio.wait_for(agent.recv(), timeout=3))
            return received and agent_resp.get("status") == "ok"


async def test_broadcast_count() -> bool:
    """Connect multiple browsers, send broadcast, verify agent gets correct count."""
    async with websockets.connect(BROWSER_URL) as b1:
        async with websockets.connect(BROWSER_URL) as b2:
            async with websockets.connect(BROWSER_URL) as b3:
                async with websockets.connect(AGENT_URL) as agent:
                    await agent.send(json.dumps({
                        "action": "broadcast",
                        "payload": {"action": "hello"},
                    }))
                    # Drain browser messages concurrently (all get the broadcast)
                    await asyncio.gather(
                        asyncio.wait_for(b1.recv(), timeout=3),
                        asyncio.wait_for(b2.recv(), timeout=3),
                        asyncio.wait_for(b3.recv(), timeout=3),
                    )
                    agent_resp = json.loads(await asyncio.wait_for(agent.recv(), timeout=3))
                    return (
                        agent_resp.get("status") == "ok"
                        and agent_resp.get("receivers") == 3
                    )


async def main() -> None:
    print("Bridge smoke tests")
    print("=" * 40)

    tests = [
        ("agent ping → health check",          test_agent_ping),
        ("agent listClients → client list",    test_list_clients := test_agent_list_clients),
        ("agent broadcast → browser receives", test_broadcast),
        ("agent updateGlobe → browser receives", test_update_globe),
        ("broadcast to 3 browsers (count=3)", test_broadcast_count),
    ]

    for label, fn in tests:
        try:
            result = await fn()
            report(label, result)
        except Exception as e:
            report(label, False)
            print(f"        -> {e}")

    passed = sum(1 for r in results if "[OK]" in r)
    total = len(results)
    print(f"\n{passed}/{total} passed")
    if passed == total:
        print("ALL TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
