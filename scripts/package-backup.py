"""Create a portable source archive using only Python's standard library."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]


def selected_files():
    for name in ('README.md', 'CREDITS.md', '.openai/hosting.json'):
        yield ROOT / name
    for folder in ('dist', 'docs', 'scripts'):
        for path in sorted((ROOT / folder).rglob('*')):
            relative = path.relative_to(ROOT)
            if not path.is_file() or path.is_symlink():
                continue
            if any(part in ('downloads', '__pycache__', '.git', 'node_modules') for part in relative.parts):
                continue
            if path.name.startswith('.env') or path.suffix in ('.pyc', '.zip', '.gz'):
                continue
            yield path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    files = list(selected_files())
    if output in files:
        raise SystemExit('Choose an archive destination outside source inputs.')
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive.write(path, 'snowvalley/' + path.relative_to(ROOT).as_posix())
    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise SystemExit('Archive integrity check failed.')
    print(json.dumps({'files': len(files), 'bytes': output.stat().st_size,
                      'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
