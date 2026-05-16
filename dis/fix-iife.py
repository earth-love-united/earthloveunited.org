#!/usr/bin/env python3
"""Completely rebuild the 4 broken DIS files with correct IIFE structure."""
import re, subprocess

def fix_file(fname, varname):
    with open(fname, 'r') as f:
        lines = f.readlines()
    
    # Find the IIFE opening line: "window.X = (() => {"
    iife_open_idx = None
    for i, line in enumerate(lines):
        if re.match(rf'window\.{varname} = \(\(\) => \{{', line.strip()):
            iife_open_idx = i
            break
    
    if iife_open_idx is None:
        print(f"  SKIP {fname}: no IIFE opening found")
        return False
    
    # Find the return block — look for "return {" with 2-space indent
    return_open_idx = None
    for i in range(iife_open_idx + 1, len(lines)):
        if re.match(r'\s+return \{', lines[i]):
            return_open_idx = i
            break
    
    if return_open_idx is None:
        print(f"  SKIP {fname}: no return block found")
        return False
    
    # Find the closing "};" of the return block
    return_close_idx = None
    brace_depth = 0
    for i in range(return_open_idx, len(lines)):
        for ch in lines[i]:
            if ch == '{':
                brace_depth += 1
            elif ch == '}':
                brace_depth -= 1
                if brace_depth == 0:
                    # This is the closing brace of the return object
                    # Check if next char is ';'
                    return_close_idx = i
                    break
        if return_close_idx is not None:
            break
    
    if return_close_idx is None:
        print(f"  SKIP {fname}: no return block close found")
        return False
    
    # Extract the parts
    # 1. Everything before the IIFE opening (comments, etc.)
    header = lines[:iife_open_idx]
    
    # 2. IIFE body (between opening and return)
    iife_body = lines[iife_open_idx + 1:return_open_idx]
    
    # 3. Return block (from "return {" to "};")
    return_block = lines[return_open_idx:return_close_idx + 1]
    
    # Build the new file
    new_lines = []
    
    # Add header (comments before IIFE)
    new_lines.extend(header)
    
    # Add IIFE opening
    new_lines.append(f'const {varname} = (() => {{\n')
    
    # Add IIFE body (skip empty lines at start)
    started = False
    for line in iife_body:
        if line.strip():
            started = True
        if started:
            new_lines.append(line)
    
    # Add return block
    new_lines.extend(return_block)
    
    # Close IIFE
    new_lines.append('})();\n')
    new_lines.append('\n')
    
    # Add exports
    new_lines.append(f'if (typeof module !== \'undefined\') module.exports = {varname};\n')
    new_lines.append(f'if (typeof window !== \'undefined\') window.{varname} = {varname};\n')
    
    with open(fname, 'w') as f:
        f.writelines(new_lines)
    
    # Verify
    result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  FIXED: {fname} ({len(new_lines)} lines)")
        return True
    else:
        print(f"  STILL BROKEN: {fname}")
        print(f"    {result.stderr.strip()[:200]}")
        return False

files = [
    ('gaia-state-machine.js', 'GaiaState'),
    ('gaia-voice-engine.js', 'GaiaVoice'),
    ('gaia-quest-system.js', 'GaiaQuests'),
    ('gaia-key-gate.js', 'GaiaKeyGate'),
]

for fname, varname in files:
    fix_file(fname, varname)

# Also fix gaia-mind.js
print("\nFixing gaia-mind.js...")
with open('gaia-mind.js', 'r') as f:
    content = f.read()

# Check if it has the window. prefix
if content.startswith('window.GaiaMind'):
    content = content.replace('window.GaiaMind = (() => {', 'const GaiaMind = (() => {', 1)
    # Remove duplicate window export at end
    content = re.sub(r'\nif \(typeof window.*GaiaMind.*\n', '\n', content)
    with open('gaia-mind.js', 'w') as f:
        f.write(content)
    result = subprocess.run(['node', '--check', 'gaia-mind.js'], capture_output=True, text=True)
    print(f"  {'FIXED' if result.returncode == 0 else 'BROKEN'}: gaia-mind.js")

# Fix gaia-voice-data.py
print("\nFixing gaia-voice-data.js...")
with open('gaia-voice-data.js', 'r') as f:
    content = f.read()

if content.startswith('window.GaiaVoiceLibrary'):
    content = content.replace('window.GaiaVoiceLibrary = {', 'const GaiaVoiceLibrary = {', 1)
    # Remove duplicate window export
    content = re.sub(r'\nif \(typeof window.*GaiaVoiceLibrary.*\n', '\n', content)
    # Add proper exports at end
    if 'module.exports' not in content:
        content += '\n\nif (typeof module !== \'undefined\') module.exports = { GaiaVoiceLibrary, VoiceLibraryMeta };\n'
    if 'window.GaiaVoiceLibrary' not in content[content.find('VoiceLibraryMeta'):]:
        content += 'if (typeof window !== \'undefined\') {\n  window.GaiaVoiceLibrary = GaiaVoiceLibrary;\n  window.VoiceLibraryMeta = VoiceLibraryMeta;\n}\n'
    with open('gaia-voice-data.js', 'w') as f:
        f.write(content)
    result = subprocess.run(['node', '--check', 'gaia-voice-data.js'], capture_output=True, text=True)
    print(f"  {'FIXED' if result.returncode == 0 else 'BROKEN'}: gaia-voice-data.js")

print("\nDone!")
