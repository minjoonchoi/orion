"""Deterministic storage for per-screen PNGs. No image regeneration."""
import sys, pathlib, zipfile, json
root = pathlib.Path(sys.argv[2])
if sys.argv[1] == 'pack':
    with zipfile.ZipFile(root / 'screens.zip', 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for row in json.loads((root / 'manifest.json').read_text())['screens']:
            info = zipfile.ZipInfo(row['file'], (2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, (root / row['file']).read_bytes())
else:
    allowed = {row['file'] for row in json.loads((root / 'manifest.json').read_text())['screens']}
    with zipfile.ZipFile(root / 'screens.zip') as z:
        if set(z.namelist()) != allowed or any(pathlib.PurePosixPath(n).name != n for n in allowed):
            raise ValueError('Archive screen inventory mismatch')
        for name in sorted(allowed):
            (root / name).write_bytes(z.read(name))
