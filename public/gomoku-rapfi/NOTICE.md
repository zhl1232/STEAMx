# Rapfi (Gomoku engine)

This directory vendors a WebAssembly build of [Rapfi](https://github.com/dhbloo/rapfi),
a Gomoku/Renju engine by dhbloo / Zhanggen Jin et al.

- Upstream: https://github.com/dhbloo/rapfi
- Web UI reference: https://github.com/dhbloo/gomoku-calculator
- Mirror build source: https://github.com/gomocalc/gomocalc.github.io (classic single-thread WASM)

Rapfi is licensed under the GNU General Public License v3.
See COPYING.txt. The engine runs as a separate Worker process and communicates
via the Piskvork/Yixin text protocol; it is not statically linked into the app bundle.
