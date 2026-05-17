import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { downloadClaimPacket, viewClaimKey, type ReleaseMaterial } from '../../lib/api';
import ClaimShell from '../../components/claim/ClaimShell';

const ClaimCard = ClaimShell;

export default function ClaimDownload() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [loadingKey, setLoadingKey] = useState(false);
  const [releaseMaterial, setReleaseMaterial] = useState<ReleaseMaterial | null>(null);

  async function handleDownload() {
    if (!token) return;
    setDownloadError('');
    setDownloading(true);
    try {
      const { blob, filename } = await downloadClaimPacket(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not_yet_accepted')) {
        setDownloadError('You must accept the claim before downloading.');
      } else if (msg.includes('packet_unavailable')) {
        setDownloadError('The packet is temporarily unavailable. Please try again later.');
      } else if (msg.includes('claim_not_found')) {
        setDownloadError('This claim link is no longer valid or has expired.');
      } else {
        setDownloadError('Download failed. Please try again.');
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleViewKey() {
    if (!token) return;
    setKeyError('');
    setLoadingKey(true);
    try {
      const result = await viewClaimKey(token);
      setReleaseMaterial(result.releaseMaterial);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('invalid_state')) {
        setKeyError('Please download the packet before viewing the release key.');
      } else if (msg.includes('release_material_unavailable')) {
        setKeyError('Release material is temporarily unavailable. Please try again later.');
      } else if (msg.includes('claim_not_found')) {
        setKeyError('This claim link is no longer valid or has expired.');
      } else {
        setKeyError('Could not retrieve release key. Please try again.');
      }
    } finally {
      setLoadingKey(false);
    }
  }

  return (
    <ClaimCard>
      <h1 className="font-hand text-3xl font-bold text-brand-ink mb-2">Download & Release Key</h1>
      <p className="font-sans text-sm text-brand-muted mb-6">
        You can now download the encrypted information packet and retrieve the release key needed to decrypt it.
        Download the packet first, then view the release key.
      </p>

      {/* Packet download */}
      <div className="mb-4 p-4 bg-brand-bg border border-brand-border rounded">
        <h2 className="font-sans font-semibold text-sm text-brand-ink mb-1">Step 1: Download Packet</h2>
        <p className="font-sans text-xs text-brand-muted mb-3">
          Download the encrypted <code>.aegis.enc</code> packet file.
        </p>
        {downloadError && (
          <div className="font-sans text-xs text-brand-danger mb-2">{downloadError}</div>
        )}
        {downloaded && (
          <div className="font-sans text-xs text-green-600 mb-2">Packet downloaded successfully.</div>
        )}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="font-sans font-semibold text-sm px-4 py-2 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
        >
          {downloading ? 'Downloading...' : downloaded ? 'Download Again' : 'Download Packet'}
        </button>
      </div>

      {/* Release key */}
      <div className="mb-6 p-4 bg-brand-bg border border-brand-border rounded">
        <h2 className="font-sans font-semibold text-sm text-brand-ink mb-1">Step 2: View Release Key</h2>
        <p className="font-sans text-xs text-brand-muted mb-3">
          Retrieve the decryption key for the packet. Save this key securely — it will not be shown again after you leave this page.
        </p>
        {keyError && (
          <div className="font-sans text-xs text-brand-danger mb-2">{keyError}</div>
        )}
        {releaseMaterial ? (
          <div className="space-y-2">
            <div className="p-3 bg-brand-surface border border-brand-border rounded font-mono text-xs text-brand-ink break-all">
              <div className="text-brand-muted mb-1">Packet Key ({releaseMaterial.encryptionAlgorithm ?? 'AES-256-GCM'}, {releaseMaterial.encoding})</div>
              <div className="select-all">{releaseMaterial.packetKey}</div>
            </div>
            {releaseMaterial.keyId && (
              <div className="font-sans text-xs text-brand-muted">Key ID: {releaseMaterial.keyId}</div>
            )}
            <p className="font-sans text-xs text-brand-danger font-semibold">
              Save this key now. It is displayed only once per session.
            </p>
          </div>
        ) : (
          <button
            onClick={handleViewKey}
            disabled={loadingKey || !downloaded}
            title={!downloaded ? 'Download the packet first' : undefined}
            className="font-sans font-semibold text-sm px-4 py-2 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
          >
            {loadingKey ? 'Retrieving...' : 'View Release Key'}
          </button>
        )}
      </div>

      <button
        onClick={() => navigate(`/claim/${token}/acknowledge`)}
        disabled={!downloaded || !releaseMaterial}
        className="w-full font-sans font-semibold text-sm p-3 cursor-pointer bg-brand-ink text-brand-bg rounded hover:bg-brand-accent transition-colors disabled:opacity-50"
      >
        Continue to Final Acknowledgement
      </button>
      {(!downloaded || !releaseMaterial) && (
        <p className="font-sans text-xs text-brand-muted mt-2 text-center">
          Complete both steps above to continue.
        </p>
      )}
    </ClaimCard>
  );
}
