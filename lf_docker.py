import importlib.metadata as m, subprocess, sys

# Langflow version
lf_ver = m.version('langflow')
print('Langflow version:', lf_ver)

# Check if Langflow has a known default data path
try:
    from langflow.services.settings.constants import LANGFLOW_DIR
    print('LANGFLOW_DIR:', LANGFLOW_DIR)
except Exception as e:
    # Try another import path
    try:
        import langflow
        lf_path = langflow.__file__
        import pathlib
        # The langflow.db is stored relative to the package
        print('Langflow package path:', str(pathlib.Path(lf_path).parent))
    except Exception as e2:
        print('Could not determine LANGFLOW_DIR:', e, e2)

# Check if LANGFLOW_DATABASE_URL env var is documented
try:
    import langflow.services.settings.base as sb
    import inspect
    src = inspect.getsource(sb)
    # Look for DATABASE_URL mentions
    lines = [l.strip() for l in src.splitlines() if 'database' in l.lower() or 'DATABASE' in l]
    for l in lines[:10]:
        print('Settings line:', l)
except Exception as e:
    print('Could not inspect settings:', e)
