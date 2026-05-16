#!/usr/bin/env python3
"""Fix all DIS files: change window.X = (() => { to const X = (() => { ... })() with exports."""
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
        content = f.read()
    
    # Replace "window.X = (() => {" with "const X = (() => {"
    content = re.sub(
        rf'window\.{varname} = \(\(\) => \{{',
        f'const {varname} = (() => {{',
        content,
        count=1
    )
    
    # Find the last "})();" and replace with "})();\n\n// Export\nif (typeof module !== 'undefined') module.exports = X;\n// Browser global\nif (typeof window !== 'undefined') window.X = X;"
    # But we need to be careful — there might be multiple ")();" in the file
    
    # Better approach: find the LAST ")();" that's at the end of the IIFE
    # The IIFE ends with "  };\n})();" or similar
    # Let's find the pattern: closing brace of return object, then })();
    
    # Find "return {" and track to its end
    return_pos = content.rfind('return {')
    if return_pos == -1:
        return_pos = content.rfind('return lib;')
    
    if return_pos != -1:
        # Find the end of the return block
        depth = 0
        i = return_pos
        while i < len(content):
            if content[i] == '{':
                depth += 1
            elif content[i] == '}':
                depth -= 1
                if depth == 0:
                    # Found end of return block
                    # Check for semicolon
                    end = i + 1
                    if end < len(content) and content[end] == ';':
                        end += 1
                    break
            i += 1
        
        # Now find everything after the return block
        after = content[end:]
        
        # Check if there's already a ")();" after the return
        close_match = re.search(r'\n\)\(\);', after)
        if close_match:
            # Replace the existing ")();" and everything after
            after_clean = after[:close_match.start()]
        else:
            after_clean = after
        
        # Reconstruct
        new_content = content[:end]
        new_content += '\n})();\n\n'
        new_content += f'if (typeof module !== \'undefined\') module.exports = {varname};\n'
        new_content += f'if (typeof window !== \'undefined\') window.{varname} = {varname};\n'
        if after_clean.strip():
            new_content += '\n' + after_clean.strip() + '\n'
        
        with open(fname, 'w') as f:
            f.write(new_content)
        
        # Verify
        result = subprocess.run(['node', '--check', fname], capture_output=True, text=True)
        if result.returncode == 0:
            print(f'  FIXED: {fname}')
        else:
            print(f'  BROKEN: {fname}: {result.stderr.strip()[:100]}')
    else:
        print(f'  SKIP: {fname} (no return block found)')

print('\nDone!')
