# WeChat protocol provenance

The request/response and notification protocol implemented in this directory follows the MIT-licensed `wxstack/wxstack` `core/pay` reference at commit `89cabd72aa21fc2547855cb1a7caff11fad8655e`, cross-checked against the official WeChat Pay v3 API documentation. Only the wire-format and cryptographic protocol concepts were independently extracted; no runtime wxstack code is bundled. Strict awaited verification and missing/unknown serial failures are intentional hardening over the reference implementation.
