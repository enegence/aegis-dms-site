# Storage Setup Guide

Aegis DMS Site uses S3-compatible object storage for encrypted packet archives. Cloudflare R2 is the recommended provider for the alpha.

---

## Bucket Setup

### Cloudflare R2 (recommended)

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com).
2. Go to **R2** → **Create bucket**.
3. **Bucket name:** `aegis-packets` (or `aegis-packets-staging` for staging). Keep names consistent — the bucket name is referenced in `AEGIS_STORAGE_BUCKET`.
4. Leave the default storage class (Standard).
5. Go to **R2** → **Manage R2 API tokens** → **Create API token**.
   - Permissions: **Object Read & Write**
   - Scope: restrict to the specific bucket (`aegis-packets`)
6. Copy the **Access Key ID** and **Secret Access Key**.

Set these environment variables:

```
AEGIS_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AEGIS_STORAGE_REGION=auto
AEGIS_STORAGE_BUCKET=aegis-packets
AEGIS_STORAGE_ACCESS_KEY_ID=<r2-access-key-id>
AEGIS_STORAGE_SECRET_ACCESS_KEY=<r2-secret-access-key>
```

### AWS S3

1. In the AWS Console, create an S3 bucket in your preferred region.
2. Create an IAM user (or role) with the following policy on the bucket:
   ```json
   {
     "Effect": "Allow",
     "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
     "Resource": "arn:aws:s3:::aegis-packets/*"
   }
   ```
3. Create access keys for the IAM user.

Set these environment variables (omit `AEGIS_STORAGE_ENDPOINT` for AWS — the SDK uses the default AWS endpoint):

```
AEGIS_STORAGE_REGION=us-east-1
AEGIS_STORAGE_BUCKET=aegis-packets
AEGIS_STORAGE_ACCESS_KEY_ID=<access-key-id>
AEGIS_STORAGE_SECRET_ACCESS_KEY=<secret-access-key>
```

---

## Object Prefixing

All packet objects are stored under the `packets/` prefix by default:

```
packets/<userId>/<packetId>.enc
```

The prefix is controlled by `AEGIS_STORAGE_PREFIX` (default: `packets/`). Do not change this in production without migrating existing objects.

---

## Permissions

The service account / API token requires:

| Permission | Why |
|---|---|
| `PutObject` (or R2 Write) | Upload packet archives on creation |
| `GetObject` (or R2 Read) | Download packets for claim processing |
| `DeleteObject` (or R2 Write) | Remove packets on release completion or admin action |

Do not grant `ListBucket`, `DeleteBucket`, or any IAM/admin permissions to the storage service account.

---

## Disabling Storage

If you do not need packet upload/download functionality (e.g. running only the Relay Monitoring product), leave `AEGIS_STORAGE_BUCKET` empty or unset. The server will start normally but packet upload routes will return an appropriate error if called.

---

## Retention Expectations

Packets are stored indefinitely until one of the following events:

- **Claim completed:** The packet is downloaded and acknowledged by the contact. After acknowledgement, the server schedules deletion of the stored object.
- **Manual admin action:** An admin deletes the packet via the admin dashboard or directly from the storage bucket.
- **User account deletion:** All packets belonging to the user are deleted as part of account cleanup (not yet automated in alpha — must be done manually from the bucket).

There is no automatic time-based expiry in the alpha. Objects accumulate until explicitly deleted.

---

## Delete Behavior

Packet deletion is triggered by:

1. **Release completion:** When a hosted release run completes and all contacts have acknowledged, the server calls `DeleteObject` on the packet archive.
2. **Admin deletion:** Direct deletion via admin dashboard or storage console.

In the alpha, not all deletion paths are fully automated. If a release run is cancelled or a packet is superseded, the old object may remain in the bucket. Periodically audit the bucket contents against the `packets` table to identify orphaned objects.

---

## Object Durability

- **Cloudflare R2:** 99.999999999% (11 nines) durability. No cross-region replication in the alpha.
- **AWS S3 Standard:** 99.999999999% durability. Enable versioning on the bucket to protect against accidental deletes.

> Packet archives are encrypted before upload. The storage provider holds ciphertext only — the encryption key is server-managed (`AEGIS_FIELD_ENCRYPTION_KEY`). Loss of that key means packets cannot be decrypted even if the objects survive.
