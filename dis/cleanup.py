#!/usr/bin/env python3
"""Clean up duplicate })(); and exports in DIS files."""
import re, subprocess

files = {
    'gaia-mind.js': 'GaiaMind',
    'gaia-state-machine.js': 'GaiaState',
    'gaia-voice-engine.js': 'GaiaVoice',
    'gaia-quest-system.js': 'GaiaQuests',
    'gaia-key-gate.js': 'GaiaKeyGate',
    'gaia-voice-data.js': 'GaiaVoiceLibrary',
}

for fname, varname in files.items():
    with open(fname, 'r') as f:
        lines = f.readlines()
    
    # Find all lines that are just ")();"
    close_lines = []
    for i, line in enumerate(lines):
        if line.strip() == ')();':
            close_lines.append(i)
    
    if len(close_lines) <= 1:
        # Check if syntax is OK anyway
        result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
        if result.returncode == 0:
            print(f'  OK: {fname}')
        else:
            print(f'  BROKEN (no dup closes): {fname}: {result.stderr.strip()[:60]}')
        continue
    
    print(f'  CLEANING: {fname} ({len(close_lines)} close markers at lines {[l+1 for l in close_lines]})')
    
    # Keep only the LAST ")();"
    last_close = close_lines[-1]
    
    new_lines = []
    for i, line in enumerate(lines):
        if i < last_close:
            if line.strip() == ')();':
                continue  # Skip duplicate closers
            if 'module.exports' in line or ('window.' in line and 'typeof' not in line):
                continue  # Skip early exports
            new_lines.append(line)
        elif i == last_close:
            new_lines.append('})();\n\n')
            new_lines.append(f'if (typeof module !== \'undefined\') module.exports = {varname};\n')
            new_lines.append(f'if (typeof window !== \'undefined\') window.{varname} = {varname};\n')
            break
        else:
            break  # Skip everything after last close
    
    with open(fname, 'w') as f:
        f.writelines(new_lines)
    
    result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
    if result.returncode == 0:
        print(f'  FIXED: {fname}')
    else:
        print(f'  BROKEN: {fname}: {result.stderr.strip()[:80]}')

print('\nDone!')
