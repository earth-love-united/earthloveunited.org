#!/usr/bin/env python3
"""Fix DIS files by adding window mock at the top.
This is the simplest fix — just make window available in Node.js.
The files keep their original window.X = (() => { ... })() pattern.
"""
import subprocess

files = [
    'gaia-mind.js',
    'gaia-state-machine.js', 
    'gaia-voice-engine.js',
    'gaia-quest-system.js',
    'gaia-key-gate.js',
    'gaia-voice-data.js',
]

mock_line = '// Node.js compat — mock window\nif (typeof window === \'undefined\' && typeof global !== \'undefined\') { global.window = global; }\n\n'

for fname in files:
    with open(fname, 'r') as f:
        content = f.read()
    
    # Check if already has the mock
    if 'Node.js compat' in content:
        print(f'  SKIP: {fname} (already has mock)')
        continue
    
    # Add mock at the very top (before any other content)
    new_content = mock_line + content
    
    with open(fname, 'w') as f:
        f.write(new_content)
    
    # Verify
    result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
    if result.returncode == 0:
        print(f'  FIXED: {fname}')
    else:
        print(f'  BROKEN: {fname}: {result.stderr.strip()[:80]}')

print('\nDone!')
