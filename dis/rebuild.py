#!/usr/bin/env python3
"""Nuclear rebuild of corrupted DIS files.
Restores the original window.X = (() => { ... })() pattern.
"""
import re, subprocess

def nuclear_rebuild(fname, varname):
    with open(fname, 'r') as f:
        lines = f.readlines()
    
    print(f"\nRebuilding {fname}...")
    
    # Step 1: Find the header comments (before any code)
    header_end = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Skip comment lines and blank lines at the top
        if stripped.startswith('//') or stripped == '' or stripped.startswith('/*'):
            header_end = i + 1
        else:
            break
    
    header = lines[:header_end]
    print(f"  Header: {header_end} lines")
    
    # Step 2: Find where the actual code starts (after "const/window X = (() => {")
    code_start = None
    for i in range(header_end, len(lines)):
        if re.search(r'(?:window|const)\.' + varname + r' = \(\(\) => \{', lines[i]):
            code_start = i + 1  # Skip the IIFE opening line
            break
        if re.search(r'const ' + varname + r' = \(\(\) => \{', lines[i]):
            code_start = i + 1
            break
    
    if code_start is None:
        print(f"  ERROR: No IIFE opening found")
        return False
    
    print(f"  Code starts at line {code_start}")
    
    # Step 3: Find the LAST "})();" — that's the real IIFE closing
    # But we need to find the one that matches the main IIFE, not nested ones
    # Strategy: find "return {" that's at the top level (2-space indent)
    # and find its matching "};"
    
    # First, let's find all "return {" at 2-space indent (top-level return)
    top_level_returns = []
    for i in range(code_start, len(lines)):
        if re.match(r'  return \{', lines[i]):
            top_level_returns.append(i)
    
    if not top_level_returns:
        print(f"  ERROR: No top-level return found")
        return False
    
    # The LAST top-level return is the main one
    main_return_line = top_level_returns[-1]
    print(f"  Main return at line {main_return_line + 1}")
    
    # Find the matching "};" for this return
    brace_depth = 0
    return_end = None
    for i in range(main_return_line, len(lines)):
        for j, ch in enumerate(lines[i]):
            if ch == '{':
                brace_depth += 1
            elif ch == '}':
                brace_depth -= 1
                if brace_depth == 0:
                    # Check for semicolon
                    if j + 1 < len(lines[i]) and lines[i][j+1] == ';':
                        return_end = i
                    else:
                        return_end = i
                    break
        if return_end is not None:
            break
    
    if return_end is None:
        print(f"  ERROR: Couldn't find return block end")
        return False
    
    print(f"  Return block ends at line {return_end + 1}")
    
    # Step 4: Extract the code body (between IIFE opening and return block end + 1)
    code_body = lines[code_start:return_end + 1]
    
    # Step 5: Clean up the code body
    # Remove any lines that are just "})();" or "})();" with whitespace
    cleaned_code = []
    for line in code_body:
        stripped = line.strip()
        if stripped in ['})();', '})();', ');', '})()']:
            print(f"  Removing stray: {stripped}")
            continue
        cleaned_code.append(line)
    
    # Step 6: Build the new file
    new_lines = []
    
    # Add header
    new_lines.extend(header)
    
    # Add IIFE opening
    new_lines.append(f'window.{varname} = (() => {{\n')
    
    # Add cleaned code body
    new_lines.extend(cleaned_code)
    
    # Make sure the return block ends with "};"
    # (it should already)
    
    # Close IIFE
    new_lines.append('})();\n')
    
    with open(fname, 'w') as f:
        f.writelines(new_lines)
    
    # Verify with node --check
    result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  SUCCESS: {fname} ({len(new_lines)} lines)")
        return True
    else:
        # Check if it's just a "window is not defined" error (which is OK for Node)
        if 'window is not defined' in result.stderr:
            print(f"  OK (window not defined in Node, but syntax is correct)")
            return True
        print(f"  STILL BROKEN: {result.stderr.strip()[:200]}")
        return False

# Fix all 4 corrupted files
files = [
    ('gaia-state-machine.js', 'GaiaState'),
    ('gaia-quest-system.js', 'GaiaQuests'),
    ('gaia-key-gate.js', 'GaiaKeyGate'),
]

for fname, varname in files:
    nuclear_rebuild(fname, varname)

# Also check gaia-mind.js and gaia-voice-data.js
for fname, varname in [('gaia-mind.js', 'GaiaMind'), ('gaia-voice-data.js', 'GaiaVoiceLibrary')]:
    result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
    if result.returncode != 0:
        if 'window is not defined' in result.stderr:
            print(f"\nOK: {fname} (window not defined in Node)")
        else:
            print(f"\nBROKEN: {fname}: {result.stderr.strip()[:100]}")
    else:
        print(f"\nOK: {fname}")

print("\nDone!")
