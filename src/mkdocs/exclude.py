"""
Exclude files in directories starting with a dot
"""

import fnmatch
import mkdocs

def on_files(files, config):
    out = []
    for f in files:
        if fnmatch.fnmatch(f.src_path, '**/.shared'):
            continue
        if fnmatch.fnmatch(f.src_path, '**/.shared/*'):
            continue
        out.append(f)
    return mkdocs.structure.files.Files(out)
