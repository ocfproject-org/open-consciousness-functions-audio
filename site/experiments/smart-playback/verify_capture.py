"""Local PCM residual gate; needs NumPy/SciPy and ffmpeg, never uploads media.

Capture names: VERSION-MOBILE-MODE-steady.f32, interleaved stereo float32/48 kHz.
All modes must start at the same source position (Short 300 = Full 542.919818).
This numerical gate detects added impulses above the control residual floor; it
is not an audibility guarantee or a substitute for a physical phone check.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np
from scipy.ndimage import shift
from scipy.optimize import minimize_scalar
from scipy.signal import correlate

SHA = '401a132683e40b34576f8411c50096521429f4ee003c8d3d684f775fe07d76ec'


def measure(x, ref):
    x = x.astype(float)
    lag = int(np.argmax(correlate(ref[:, 0], x[:, 0], mode='valid', method='fft')))
    y = ref[lag:lag + len(x)]
    def fit(delta):
        yy = shift(y[:48000], (delta, 0), order=3, mode='nearest')
        xx = x[:48000]
        gain = np.sum(yy * xx) / np.sum(yy * yy)
        return np.mean((xx[32:-32] - gain * yy[32:-32]) ** 2)
    delta = minimize_scalar(fit, bounds=(-.6, .6), method='bounded').x
    y = shift(y, (delta, 0), order=3, mode='nearest')
    gain = np.sum(y * x) / np.sum(y * y)
    residual = (x - gain * y)[64:-64]
    peak = float(np.max(np.abs(residual)))
    p999 = float(np.quantile(np.abs(residual), .999))
    return dict(lag_samples=lag, fractional_shift=float(delta), gain=float(gain),
                correlation=[float(np.corrcoef(x[:, i], y[:, i])[0, 1]) for i in range(2)],
                residual_rms=float(np.sqrt(np.mean(residual ** 2))), residual_peak=peak,
                residual_step_peak=float(np.max(np.abs(np.diff(residual, axis=0)))),
                residual_p999=p999, impulse_ratio=peak / max(p999, 1e-12))


def passes(row, native_peak):
    return (min(row['correlation']) > .9998 and
            row['residual_peak'] < max(.005, native_peak * 8) and
            row['residual_step_peak'] < max(.008, native_peak * 12) and
            row['impulse_ratio'] < 8)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--captures', type=Path, required=True)
    args = parser.parse_args()
    if hashlib.sha256(args.source.read_bytes()).hexdigest() != SHA:
        raise ValueError('Wrong public source')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '540.919818', '-i', str(args.source), '-t', '25', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    ref = np.frombuffer(raw, dtype='<f4').reshape(-1, 2).astype(float)
    rows = []
    paths = sorted(args.captures.glob('*-steady.f32'))
    expected = {f'{version}-{mobile}-{mode}-steady.f32' for version in ('before', 'after') for mobile in ('false', 'true') for mode in ('native', 'pass', 'short')}
    if {path.name for path in paths} != expected:
        raise ValueError('Incomplete matched capture matrix')
    for path in paths:
        x = np.fromfile(path, dtype='<f4').reshape(-1, 2)
        rows.append(dict(file=path.name, frames=len(x), **measure(x, ref)))
    native_peak = max(row['residual_peak'] for row in rows if '-native-' in row['file'])
    for row in rows:
        row['passed'] = passes(row, native_peak)
    # A deterministic added single-frame impulse must fail this actual gate.
    fixture = ref[100000:200000].copy()
    fixture[50000] += .1
    injected = measure(fixture, ref)
    if passes(injected, native_peak):
        raise AssertionError('Residual gate failed to reject injected impulse')
    report = dict(source_sha256=SHA, rate=48000, matched_source_position=542.919818,
                  native_residual_peak=native_peak, injected_impulse_rejected=True, rows=rows)
    (args.captures / 'residual-gate.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    if not all(row['passed'] for row in rows):
        raise SystemExit('Residual gate failed; do not claim clean output')


if __name__ == '__main__':
    main()
