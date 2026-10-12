# VCS object storage

VCS uses one private GCS bucket for application files. Apps do not create buckets, receive GCS/HMAC/service-account credentials, or choose another project's prefix. The platform signs a single operation under `owner/project-slug/project-uuid/`; the UUID prevents a deleted/recreated project from inheriting old files. Use the injected prefix, never reconstruct it from a display name.

Every app deployed after storage is configured receives:

- `VCS_STORAGE_URL`: the platform signing endpoint.
- `VCS_STORAGE_TOKEN`: project-bound server-only token, mounted from Secret Manager.
- `VCS_STORAGE_BUCKET`, `VCS_STORAGE_PREFIX`: informational storage identity, not credentials.

Existing apps receive these on their next VCS deploy. Adapt an existing S3 adapter to this API during authorized adoption; remove required S3/SMTP placeholders from env validation. Do not claim attachments work until an actual upload/download succeeds.

## API

The app server sends `POST VCS_STORAGE_URL` with `Authorization: Bearer VCS_STORAGE_TOKEN` and JSON:

```json
{"action":"upload","key":"attachments/6f0d2e1b-132a-4615-9ec5-e34ddbb1b481","size":12345,"content_type":"application/pdf"}
```

Actions: `upload` (PUT), `download` (GET), `stat` (HEAD), `delete` (DELETE). Keys are relative paths of 1-512 bytes with segments starting with a letter/digit and containing only letters, digits, dot, dash or underscore. Use random IDs, not user-supplied filenames; never prepend `VCS_STORAGE_PREFIX` to the request key. The server enforces the prefix even if an app invents a different relative path.

Uploads require exact size (1 byte to 50 MiB) and MIME type. A returned grant contains `url`, `method`, `headers`, `key`, `expires_at`. Execute its method with every returned header; upload uses the raw file as the body. The signed size range is exact and GCS rejects a different size. Uploads are create-only; to replace a file, use a new key and update the DB reference. URLs expire after five minutes and confer temporary access to anyone holding them; never persist or log them.

For download, send `{"action":"download","key":"attachments/...","filename":"report.pdf"}`. GCS serves it as an attachment. `stat` verifies size/content type after upload; `delete` removes one object. Store relative keys and verified metadata in the app DB. Keep signed URL expiry independent of session lifetime.

Errors: 400 invalid key/request/size, 401 invalid storage token, 403 disabled/deleted project, 429 allowance exhausted, 503 storage unconfigured/unavailable, 502 signing failed. Allowance: 10,000 grants and 1 GiB of declared upload grants per project per UTC day; retries consume allowance, including grants whose upload never completes. This is not a total stored-byte quota.

```js
async function storageGrant(request) {
  const response = await fetch(process.env.VCS_STORAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VCS_STORAGE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`VCS storage failed: ${response.status}`)
  return response.json()
}
```

## Application responsibilities

- Check the signed-in user's permission on the parent task/RFC/issue before every upload, download and delete grant. The platform enforces project isolation; the app enforces user/entity isolation. Never expose the platform token to the browser.
- For large files, return an upload grant to the authorized browser and upload directly to GCS. This avoids buffering video in the app and Cloud Run's HTTP/1 request size limit. Browser access uses the grant, never a public bucket or GCS credentials.
- Client MIME/filename is not proof of file type. Before marking a file ready, verify uploaded size and inspect content/magic bytes through server-side access. Reject/delete invalid files, enforce per-entity limits, and expose only ready files to downloads. Preserve an existing validation implementation.
- Handle partial failure: no DB row marked ready before upload/validation succeeds; remove orphan objects after failed DB writes. A retry reuses a key only after checking whether the original upload succeeded; create-only 412 may mean it did.
- Do not introduce FUSE mounts, persistent disks, an S3 proxy, separate storage workers, or another bucket for each app. Use existing HTTP and DB mechanisms.
- Acceptance: authorized upload/download/delete; oversize or wrong-size upload rejected; unauthorized entity access denied; another project's token cannot fetch/delete the object; bucket remains private.
