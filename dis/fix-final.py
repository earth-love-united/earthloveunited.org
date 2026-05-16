#!/usr/bin/env python3
"""Fix IIFE structure: move })(); right after return block, before exports."""
import re, subprocess

files = {
    'gaia-state-machine.js': 'GaiaState',
    'gaia-voice-engine.js': 'GaiaVoice',
    'gaia-quest-system.js': 'GaiaQuests',
    'gaia-key-gate.js': 'GaiaKeyGate',
    'gaia-voice-data.js': 'GaiaVoiceLibrary',
}

for fname, varname in files.items():
    with open(fname, 'r') as f:
        content = f.read()
    
    # Find the return block: "return {" ... "};"
    # Look for "  return {" (2-space indent, top-level in IIFE)
    return_match = re.search(r'(\n  return \{)', content)
    if not return_match:
        print(f'  SKIP {fname}: no return block')
        continue
    
    return_start = return_match.start()
    
    # Find the closing "};" of the return block
    depth = 0
    i = return_start
    found = False
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                # Include semicolon
                return_end = i + 1
                if return_end < len(content) and content[return_end] == ';':
                    return_end += 1
                found = True
                break
        i += 1
    
    if not found:
        print(f'  SKIP {fname}: no return close')
        continue
    
    # Everything after the return block
    after = content[return_end:]
    
    # Reconstruct: header + IIFE body + return + })(); + exports
    header = content[:return_start]  # includes "  return {"
    # Actually, we need everything from IIFE start to return start
    # Let me re-extract
    
    # Find IIFE opening
    iife_match = re.search(rf'const {varname} = \(\(\) => \{{', content)
    if not iife_match:
        print(f'  SKIP {fname}: no IIFE opening')
        continue
    
    iife_body = content[iife_match.end():return_start]
    return_block = content[return_start:return_end]
    
    # Build new content
    new_content = content[:iife_match.start()]  # header comments
    new_content += f'const {varname} = (() => {{\n'
    new_content += iife_body
    new_content += return_block + '\n'
    new_content += '})();\n\n'
    new_content += f'if (typeof module !== \'undefined\') module.exports = {varname};\n'
    new_content += f'if (typeof window !== \'undefined\') window.{varname} = {varname};\n'
    
    with open(fname, 'w') as f:
        f.write(new_content)
    
    result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
    if result.returncode == 0:
        print(f'  FIXED: {fname}')
    else:
        print(f'  BROKEN: {fname}: {result.stderr.strip()[:80]}')

print('\nDone!')
