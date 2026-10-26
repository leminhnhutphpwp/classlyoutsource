/**
 * Canonical Vietnamese bank list for VietQR — mirror of App\Support\VietQrBank
 * (apps/api/app/Support/VietQrBank.php). The monorepo has no shared package, so
 * keep BOTH lists in sync when adding/renaming a bank.
 *
 * 'name' is the canonical display name stored in user_bank_accounts; 'code' is the
 * VietQR short code used in img.vietqr.io/image/{code}-... URLs.
 */
export const VIETQR_BANKS: Array<{ name: string; code: string }> = [
  { name: 'Vietcombank', code: 'VCB' },
  { name: 'Techcombank', code: 'TCB' },
  { name: 'MBBank', code: 'MB' },
  { name: 'ACB', code: 'ACB' },
  { name: 'VPBank', code: 'VPB' },
  { name: 'TPBank', code: 'TPB' },
  { name: 'BIDV', code: 'BIDV' },
  { name: 'VietinBank', code: 'ICB' },
  { name: 'Agribank', code: 'VBA' },
  { name: 'Sacombank', code: 'STB' },
  { name: 'HDBank', code: 'HDB' },
  { name: 'VIB', code: 'VIB' },
  { name: 'MSB', code: 'MSB' },
  { name: 'SHB', code: 'SHB' },
  { name: 'SeABank', code: 'SEAB' },
  { name: 'OCB', code: 'OCB' },
  { name: 'Eximbank', code: 'EIB' },
  { name: 'LienVietPostBank', code: 'LPB' },
  { name: 'Nam A Bank', code: 'NAB' },
  { name: 'VietBank', code: 'VBB' },
  { name: 'BaoVietBank', code: 'BVB' },
  { name: 'SaigonBank', code: 'SGB' },
  { name: 'PG Bank', code: 'PGB' },
  { name: 'KienLongBank', code: 'KLB' },
  { name: 'VietABank', code: 'VAB' },
  { name: 'OceanBank', code: 'OJB' },
  { name: 'DongABank', code: 'DAB' },
  { name: 'Woori Bank', code: 'WRB' },
  { name: 'CBBank', code: 'CBB' },
  { name: 'PublicBank', code: 'PBB' },
];

/** Resolve the VietQR short code from a bank name OR an already-short code (case-insensitive). */
export function codeForBank(nameOrCode: string): string | null {
  const needle = nameOrCode.trim().toLowerCase();
  const hit = VIETQR_BANKS.find(
    (b) => b.name.toLowerCase() === needle || b.code.toLowerCase() === needle
  );
  return hit ? hit.code : null;
}

/** Resolve the canonical display name from a bank name OR short code (case-insensitive). */
export function canonicalBankName(nameOrCode: string): string | null {
  const needle = nameOrCode.trim().toLowerCase();
  const hit = VIETQR_BANKS.find(
    (b) => b.name.toLowerCase() === needle || b.code.toLowerCase() === needle
  );
  return hit ? hit.name : null;
}
