import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import {
  Camera,
  CheckCircle2,
  Download,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ScanBarcode,
  StopCircle,
  User as UserIcon,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Asset, Department, User } from '../types';
import { StatusTag } from './StatusBadge';

interface AssetScannerModalProps {
  initialAsset?: Asset | null;
  users: User[];
  departments: Department[];
  canEdit: boolean;
  onClose: () => void;
  onAssetUpdated: () => void;
}

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Needs Maintenance', 'Damaged', 'Retired'] as const;
const STATUSES = ['Operational', 'In Repair', 'Under Maintenance', 'Decommissioned'] as const;

export function AssetScannerModal({
  initialAsset,
  users,
  departments,
  canEdit,
  onClose,
  onAssetUpdated,
}: AssetScannerModalProps) {
  const [tab, setTab] = useState<'scan' | 'label'>(initialAsset ? 'label' : 'scan');
  const [scanInput, setScanInput] = useState(initialAsset?.asset_identification_number || '');
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(initialAsset || null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Quick update fields after scan
  const [editIdNumber, setEditIdNumber] = useState(initialAsset?.asset_identification_number || '');
  const [editAssignedUserId, setEditAssignedUserId] = useState(
    initialAsset?.assigned_user_id ? String(initialAsset.assigned_user_id) : ''
  );
  const [editStatus, setEditStatus] = useState(initialAsset?.status || 'Operational');
  const [editCondition, setEditCondition] = useState(initialAsset?.condition || 'Good');
  const [editLocation, setEditLocation] = useState(initialAsset?.location || '');
  const [editDeptId, setEditDeptId] = useState(
    initialAsset?.department_id ? String(initialAsset.department_id) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // QR label image URL
  const [qrDataUrl, setQrDataUrl] = useState('');

  const syncFormFromAsset = (asset: Asset) => {
    setScannedAsset(asset);
    setEditIdNumber(asset.asset_identification_number || asset.asset_tag);
    setEditAssignedUserId(asset.assigned_user_id ? String(asset.assigned_user_id) : '');
    setEditStatus(asset.status);
    setEditCondition(asset.condition);
    setEditLocation(asset.location);
    setEditDeptId(asset.department_id ? String(asset.department_id) : '');
    setSaveSuccess('');
  };

  useEffect(() => {
    if (!scannedAsset) {
      setQrDataUrl('');
      return;
    }

    const payload = JSON.stringify({
      asset_identification_number: scannedAsset.asset_identification_number || scannedAsset.asset_tag,
      asset_tag: scannedAsset.asset_tag,
      serial_number: scannedAsset.serial_number,
      name: scannedAsset.name,
      category: scannedAsset.category_name,
      status: scannedAsset.status,
      condition: scannedAsset.condition,
      location: scannedAsset.location,
      assigned_user: scannedAsset.assigned_user_id
        ? {
            id: scannedAsset.assigned_user_id,
            full_name: scannedAsset.assigned_user_name,
            email: scannedAsset.assigned_user_email || null,
            phone: scannedAsset.assigned_user_phone || null,
            staff_student_id: scannedAsset.assigned_user_staff_id || null,
            role: scannedAsset.assigned_user_role || null,
            department: scannedAsset.assigned_user_department || null,
          }
        : null,
    });

    QRCode.toDataURL(payload, {
      width: 240,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [scannedAsset]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Ignore stop errors if camera was already closed
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (tab === 'scan' && inputRef.current) {
      inputRef.current.focus();
    }
    return () => {
      void stopCamera();
    };
  }, [tab]);

  const lookupCode = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    setLookupError('');
    setSaveSuccess('');
    setLookupLoading(true);
    try {
      const res = await apiRequest<{ asset: Asset }>(`/api/assets/lookup/${encodeURIComponent(trimmed)}`);
      syncFormFromAsset(res.asset);
      setScanInput(res.asset.asset_identification_number || trimmed);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Asset lookup failed');
    } finally {
      setLookupLoading(false);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const scanner = new Html5Qrcode('ict-qr-reader');
      scannerRef.current = scanner;
      setCameraActive(true);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          void stopCamera();
          setScanInput(decodedText);
          void lookupCode(decodedText);
        },
        () => {
          // Ignore frame-by-frame non-match scans
        }
      );
    } catch (err) {
      setCameraActive(false);
      setCameraError(
        err instanceof Error
          ? `Camera unavailable (${err.message}). Use a connected USB barcode scanner or enter the tag below.`
          : 'Camera access unavailable. Use a hardware barcode scanner or enter the tag manually.'
      );
    }
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    void lookupCode(scanInput);
  };

  const handleQuickUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedAsset) return;
    setSaving(true);
    setLookupError('');
    setSaveSuccess('');
    try {
      const res = await apiRequest<{ asset: Asset }>(`/api/assets/${scannedAsset.id}/quick-scan`, {
        method: 'PATCH',
        body: JSON.stringify({
          assetIdentificationNumber: editIdNumber.trim(),
          assignedUserId: editAssignedUserId ? Number(editAssignedUserId) : null,
          status: editStatus,
          condition: editCondition,
          location: editLocation.trim(),
          departmentId: editDeptId ? Number(editDeptId) : null,
        }),
      });
      syncFormFromAsset(res.asset);
      setSaveSuccess('Scanned asset identification, custodian, status, and location saved.');
      onAssetUpdated();
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Failed to update scanned asset');
    } finally {
      setSaving(false);
    }
  };

  const downloadQrLabel = () => {
    if (!qrDataUrl || !scannedAsset) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${scannedAsset.asset_identification_number || scannedAsset.asset_tag}_qr_label.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ScanBarcode className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="font-display text-base font-bold">Barcode &amp; QR Asset Scanner</h2>
              <p className="text-xs text-slate-300">
                Scan via mobile/webcam camera or USB barcode scanner to look up and update assets.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void stopCamera();
              onClose();
            }}
            className="text-slate-300 hover:text-white p-1"
            aria-label="Close scanner modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
          <button
            type="button"
            onClick={() => setTab('scan')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'scan'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Scan &amp; Quick Update
          </button>
          <button
            type="button"
            onClick={() => {
              void stopCamera();
              setTab('label');
            }}
            disabled={!scannedAsset}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer disabled:opacity-40 ${
              tab === 'label'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            QR Tag &amp; Full Custodian Details
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {tab === 'scan' && (
            <>
              {/* Camera + Hardware Scanner Input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-900">Camera Barcode / QR Reader</span>
                      {cameraActive ? (
                        <button
                          type="button"
                          onClick={() => void stopCamera()}
                          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 cursor-pointer"
                        >
                          <StopCircle className="h-3.5 w-3.5" />
                          <span>Stop Camera</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void startCamera()}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 cursor-pointer"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span>Start Camera</span>
                        </button>
                      )}
                    </div>
                    <div
                      id="ict-qr-reader"
                      className="w-full min-h-[160px] rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden text-xs text-slate-400"
                    >
                      {!cameraActive && 'Click "Start Camera" to scan a QR code or barcode'}
                    </div>
                    {cameraError && (
                      <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                        {cameraError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                  <form onSubmit={handleManualLookup} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-900 mb-1">
                        Hardware Scanner / Asset Identification Number
                      </label>
                      <p className="text-[11px] text-slate-500 mb-2">
                        Focus this field and scan with a connected USB/Bluetooth barcode gun, or type an Asset ID / Serial Number.
                      </p>
                      <input
                        ref={inputRef}
                        type="text"
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        placeholder="Scan or enter e.g. ICT-DSK-1001"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={lookupLoading}
                      className="w-full rounded-lg bg-slate-900 py-2 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                    >
                      {lookupLoading ? 'Looking up asset...' : 'Lookup Scanned Asset'}
                    </button>
                  </form>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-medium text-slate-500 mb-1.5">Quick test tags:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {['ICT-DSK-1001', 'ICT-LPT-2004', 'ICT-PRT-3002', 'ICT-PRJ-7001'].map((sample) => (
                        <button
                          key={sample}
                          type="button"
                          onClick={() => {
                            setScanInput(sample);
                            void lookupCode(sample);
                          }}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-blue-700 hover:bg-blue-50 cursor-pointer"
                        >
                          {sample}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {lookupError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                  {lookupError}
                </div>
              )}

              {saveSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              {/* Scanned Asset + Assigned User Details + Quick Update */}
              {scannedAsset && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <div className="font-mono text-xs font-semibold text-blue-700">
                        ID#: {scannedAsset.asset_identification_number} · SN: {scannedAsset.serial_number}
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-900 mt-0.5">{scannedAsset.name}</h3>
                      <div className="text-xs text-slate-600">
                        {scannedAsset.category_name} · {scannedAsset.manufacturer} {scannedAsset.model || ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusTag value={scannedAsset.condition} />
                      <StatusTag value={scannedAsset.status} />
                    </div>
                  </div>

                  {/* Full Assigned User Details Card */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5" />
                      <span>Assigned Custodian &amp; Full User Details</span>
                    </div>
                    {scannedAsset.assigned_user_id ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div>
                          <span className="text-slate-500">Full Name:</span>{' '}
                          <span className="font-semibold text-slate-900">{scannedAsset.assigned_user_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Staff/Student ID:</span>{' '}
                          <span className="font-mono text-slate-900">{scannedAsset.assigned_user_staff_id || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-slate-900">{scannedAsset.assigned_user_email || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-mono text-slate-900">{scannedAsset.assigned_user_phone || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Role:</span>{' '}
                          <span className="font-medium text-slate-900">{scannedAsset.assigned_user_role || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Department:</span>{' '}
                          <span className="text-slate-900">{scannedAsset.assigned_user_department || '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">This asset is currently unassigned.</div>
                    )}
                  </div>

                  {canEdit && (
                    <form onSubmit={handleQuickUpdate} className="space-y-3 pt-2">
                      <div className="text-xs font-semibold text-slate-900">
                        Quick Update from Scan (Assign User, Status, Location &amp; ID)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">
                            asset_identification_number
                          </label>
                          <input
                            type="text"
                            required
                            value={editIdNumber}
                            onChange={(e) => setEditIdNumber(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">Assign to User</label>
                          <select
                            value={editAssignedUserId}
                            onChange={(e) => setEditAssignedUserId(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                          >
                            <option value="">Unassigned</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.full_name} ({u.role_name} · {u.staff_student_id || u.email})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">Operational Status</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as Asset['status'])}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">Condition</label>
                          <select
                            value={editCondition}
                            onChange={(e) => setEditCondition(e.target.value as Asset['condition'])}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                          >
                            {CONDITIONS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">Department</label>
                          <select
                            value={editDeptId}
                            onChange={(e) => setEditDeptId(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                          >
                            <option value="">Unassigned</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">Location</label>
                          <div className="relative">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              value={editLocation}
                              onChange={(e) => setEditLocation(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                        >
                          {saving ? 'Saving...' : 'Save Scanned Asset Update'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'label' && scannedAsset && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col items-center text-center">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-3">
                  <QrCode className="h-4 w-4 text-blue-600" />
                  <span>Asset QR Code (Encodes Full User &amp; Asset Payload)</span>
                </div>
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${scannedAsset.asset_identification_number}`}
                    className="h-52 w-52 rounded-lg border border-slate-200 p-2 bg-white"
                  />
                ) : (
                  <div className="h-52 w-52 rounded-lg border border-slate-200 flex items-center justify-center text-xs text-slate-400">
                    Generating QR...
                  </div>
                )}
                <div className="mt-3 font-mono text-sm font-bold text-slate-900">
                  {scannedAsset.asset_identification_number}
                </div>
                <div className="text-xs text-slate-500">SN: {scannedAsset.serial_number}</div>
                <button
                  type="button"
                  onClick={downloadQrLabel}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download QR Label PNG</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">{scannedAsset.name}</h3>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {scannedAsset.category_name} · {scannedAsset.manufacturer} {scannedAsset.model || ''}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500">Asset ID Number</div>
                    <div className="font-mono font-semibold text-slate-900">{scannedAsset.asset_identification_number}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Location</div>
                    <div className="font-medium text-slate-900">{scannedAsset.location}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Condition</div>
                    <div className="mt-0.5"><StatusTag value={scannedAsset.condition} /></div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="mt-0.5"><StatusTag value={scannedAsset.status} /></div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Custodian / Assigned User Details</div>
                  {scannedAsset.assigned_user_id ? (
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div><span className="text-slate-500">Name:</span> <span className="font-semibold text-slate-900">{scannedAsset.assigned_user_name}</span></div>
                      <div><span className="text-slate-500">Email:</span> {scannedAsset.assigned_user_email || '—'}</div>
                      <div><span className="text-slate-500">Phone:</span> <span className="font-mono">{scannedAsset.assigned_user_phone || '—'}</span></div>
                      <div><span className="text-slate-500">Staff/Student ID:</span> <span className="font-mono">{scannedAsset.assigned_user_staff_id || '—'}</span></div>
                      <div><span className="text-slate-500">Role:</span> {scannedAsset.assigned_user_role || '—'}</div>
                      <div><span className="text-slate-500">Department:</span> {scannedAsset.assigned_user_department || '—'}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Unassigned institutional asset</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
