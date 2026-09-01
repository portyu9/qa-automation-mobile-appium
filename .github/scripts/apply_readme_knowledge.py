from pathlib import Path
import re

path = Path('README.md')
text = path.read_text(encoding='utf-8')
marker = '## Dependency maintenance\n'
section = '''## Confidence boundaries

Mobile automation crosses framework policy, Appium protocol/session lifecycle, application state, device operating systems, provider infrastructure, and physical hardware. The repository keeps those confidence claims separate.

| Signal | Confidence gained | Deliberate limit |
| --- | --- | --- |
| Framework/session-manager contracts | Capability construction, runtime validation, session ownership, teardown precedence, sanitization, and evidence policy behave deterministically with controlled doubles | They do not prove that an Appium server, driver, application binary, emulator, simulator, cloud device, or physical device is reachable or compatible |
| Capability policy | Platform, target, reset behavior, cloud-option structure, and secret-like configuration are validated before session creation | Valid capabilities are admissible configuration, not proof that a provider accepts them or that the requested device exists |
| Screen/page abstractions | Application interactions and assertions have stable ownership without hiding the underlying WebdriverIO/Appium session model | A screen abstraction cannot make an unstable locator, inaccessible element, or unsupported platform behavior reliable |
| Failure evidence before teardown | A primary test failure can retain bounded diagnostics while teardown/evidence failures cannot silently replace the original cause | Captured evidence may still be incomplete if the device/provider is unreachable or the session is already irrecoverable |
| Manual real-device smoke | A protected environment can create a real session, retrieve meaningful application hierarchy/context information, and close the session with retained sanitized evidence | One successful device/provider/platform run is not universal device, OS, form-factor, locale, network, permission, performance, or application coverage |
| Serialized device workflow | Concurrent manual runs do not intentionally compete for the repository's shared device-lab execution slot | Serialization does not create provider capacity, eliminate external queueing, or guarantee device availability |
| Success summary artifact | A green device run retains non-secret platform/device/context/capability evidence rather than relying only on logs | The summary proves the executed session boundary, not user-journey correctness beyond the smoke assertions |
| Deterministic CI | Framework behavior remains testable without requiring paid cloud devices or lab availability | Green deterministic CI deliberately cannot substitute for real-device qualification |
| CodeQL / npm Audit / Trivy / dependency review | Independent controls inspect source, advisory, repository/configuration/secret, and dependency-diff surfaces | Green scanners are scoped evidence, not proof of vulnerability absence |

Treat device coverage as a **risk matrix**, not a count of sessions. Add platforms, OS generations, form factors, locales, permission states, networks, and providers only when product risk requires them; do not confuse one broad matrix with deterministic framework health.

'''
if '## Confidence boundaries\n' not in text:
    if marker not in text:
        raise SystemExit('Dependency maintenance marker missing')
    text = text.replace(marker, section + marker)
path.write_text(text, encoding='utf-8')

patterns = [
    re.compile(r'\bAppium\s+v?\d', re.I),
    re.compile(r'\bWebdriverIO\s+v?\d', re.I),
    re.compile(r'\bNode(?:\.js)?\s+\d', re.I),
    re.compile(r'\bTypeScript\s+v?\d', re.I),
    re.compile(r'@types/node\s+v?\d', re.I),
    re.compile(r'\bnpm\s+v?\d', re.I),
    re.compile(r'\bAndroid\s+\d+(?:\.\d+)*', re.I),
    re.compile(r'\biOS\s+\d+(?:\.\d+)*', re.I),
]
candidates = []
for md in [Path('README.md'), *Path('docs').rglob('*.md')]:
    for number, line in enumerate(md.read_text(encoding='utf-8').splitlines(), 1):
        if any(pattern.search(line) for pattern in patterns):
            candidates.append(f'{md}:{number}: {line}')
if candidates:
    raise SystemExit('Residual Appium/tool version candidates:\n' + '\n'.join(candidates))
