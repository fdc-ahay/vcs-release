# Domain integration

1. Run bundled CLI `domains list`; it uses the current `vcs` remote binding. Never invent available domains or edit DNS manually.
2. Show returned `approved_roots` as choices in native question UI. Ask subdomain text in that same interaction when possible. Preserve an existing confirmed choice; zero repeat questions.
3. Run `domains connect --root ROOT --subdomain LABEL`. The CLI validates the approved root and DNS label, creates the binding only when missing, and polls platform DNS/TLS automatically. No user polls, cloud console, or terminal.
4. Success requires `status: active`, which means platform routing and certificate are ready. Then smoke-test HTTPS application behavior and report final URL. Review application OAuth callbacks, mail links, notification URLs, and CORS when changing public URL; preserve auth and integrations.
5. On `pending`, resume `domains status --hostname HOST` yourself. On `failed`, show concrete platform error, resolve the known platform cause and use `domains retry --hostname HOST` if authorized. Never claim TLS ready from DNS alone.

Domain operations are separate from database cutover. Do not move data or modify application business features while connecting a domain.
