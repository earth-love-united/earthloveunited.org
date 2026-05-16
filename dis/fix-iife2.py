#!/usr/bin/env python3
"""Rebuild broken DIS files with correct IIFE structure.
Reads the corrupted file, extracts the code, and rebuilds it properly.
"""
import re, subprocess

def rebuild_file(fname, varname):
    with open(fname, 'r') as f:
        content = f.read()
    
    # The file should have this structure (possibly corrupted):
    #   [comments]
    #   const/window X = (() => {
    #     [code with const/let/functions]
    #     return { [public API] };
    #   })();
    #   [exports]
    
    # Strategy: find everything between the IIFE opening and the LAST "})();"
    # That's the IIFE. Everything after is exports.
    
    # Find IIFE opening
    iife_open = re.search(r'(?:window|const)\.' + varname + r' = \(\(\) => \{', content)
    if not iife_open:
        iife_open = re.search(r'const ' + varname + r' = \(\(\) => \{', content)
    if not iife_open:
        print(f"  ERROR: No IIFE opening in {fname}")
        return False
    
    # Find the LAST ")();" — that's the IIFE closing
    last_close = content.rfind('})();')
    if last_close == -1:
        last_close = content.rfind(')();')
    
    if last_close == -1:
        print(f"  ERROR: No IIFE closing in {fname}")
        return False
    
    # Extract header (before IIFE)
    header = content[:iife_open.start()]
    
    # Extract IIFE body (between opening and closing)
    iife_start = iife_open.end()
    iife_body = content[iife_start:last_close]
    
    # Extract exports (after IIFE)
    after_close = content[last_close + len('})();'):]
    
    # Check if iife_body has a "return {" — if not, it's a plain object
    has_return = 'return {' in iife_body or 'return{' in iife_body
    
    # Build new content
    new_content = header
    new_content += f'const {varname} = (() => {{\n'
    new_content += iife_body
    
    # Make sure it ends with "return { ... };" if it has a return
    if has_return:
        # Find the last "return {" and make sure it's the final statement
        last_return = iife_body.rfind('return {')
        if last_return >= 0:
            # Check if there's code after the return that's not part of it
            after_return = iife_body[last_return:]
            # The return should end with "};"
            return_end = after_return.rfind('};')
            if return_end >= 0:
                # Trim everything after the return block
                iife_body = iife_body[:last_return + return_end + 2]
                new_content = header
                new_content += f'const {varname} = (() => {{\n'
                new_content += iife_body + '\n'
            else:
                new_content += '\n'
    else:
        # Plain object — just close it
        new_content += '\n'
    
    new_content += '})();\n\n'
    new_content += f'if (typeof module !== \'undefined\') module.exports = {varname};\n'
    new_content += f'if (typeof window !== \'undefined\') window.{varname} = {varname};\n'
    
    with open(fname, 'w') as f:
        f.write(new_content)
    
    # Verify
    result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  FIXED: {fname}")
        return True
    else:
        print(f"  BROKEN: {fname}: {result.stderr.strip()[:150]}")
        return False

files = [
    ('gaia-state-machine.js', 'GaiaState'),
    ('gaia-quest-system.js', 'GaiaQuests'),
    ('gaia-key-gate.js', 'GaiaKeyGate'),
]

for fname, varname in files:
    rebuild_file(fname, varname)

print("\nDone!")
