<?php

namespace App\Support;

/**
 * Canonical Vietnamese bank list for VietQR image generation.
 *
 * VietQR (img.vietqr.io) expects the bank *short code* (e.g. "TCB", "VCB") in the
 * image URL — NOT the display name. This class is the single source of truth for
 * the name -> code mapping used by:
 *   - PaymentResource::getBankTransferInfo()  (builds the QR URL),
 *   - SettingsController::updateBankInfo()    (validates + normalizes the tutor's bank_name).
 *
 * The frontend keeps a mirror copy in apps/app/src/lib/vietqr-banks.ts (monorepo
 * has no shared package) — keep both lists in sync when adding/renaming a bank.
 */
class VietQrBank
{
    /**
     * Bank list: 'name' is the canonical display name stored in user_bank_accounts,
     * 'code' is the VietQR short code used in img.vietqr.io/image/{code}-...
     */
    public const BANKS = [
        ['name' => 'Vietcombank', 'code' => 'VCB'],
        ['name' => 'Techcombank', 'code' => 'TCB'],
        ['name' => 'MBBank', 'code' => 'MB'],
        ['name' => 'ACB', 'code' => 'ACB'],
        ['name' => 'VPBank', 'code' => 'VPB'],
        ['name' => 'TPBank', 'code' => 'TPB'],
        ['name' => 'BIDV', 'code' => 'BIDV'],
        ['name' => 'VietinBank', 'code' => 'ICB'],
        ['name' => 'Agribank', 'code' => 'VBA'],
        ['name' => 'Sacombank', 'code' => 'STB'],
        ['name' => 'HDBank', 'code' => 'HDB'],
        ['name' => 'VIB', 'code' => 'VIB'],
        ['name' => 'MSB', 'code' => 'MSB'],
        ['name' => 'SHB', 'code' => 'SHB'],
        ['name' => 'SeABank', 'code' => 'SEAB'],
        ['name' => 'OCB', 'code' => 'OCB'],
        ['name' => 'Eximbank', 'code' => 'EIB'],
        ['name' => 'LienVietPostBank', 'code' => 'LPB'],
        ['name' => 'Nam A Bank', 'code' => 'NAB'],
        ['name' => 'VietBank', 'code' => 'VBB'],
        ['name' => 'BaoVietBank', 'code' => 'BVB'],
        ['name' => 'SaigonBank', 'code' => 'SGB'],
        ['name' => 'PG Bank', 'code' => 'PGB'],
        ['name' => 'KienLongBank', 'code' => 'KLB'],
        ['name' => 'VietABank', 'code' => 'VAB'],
        ['name' => 'OceanBank', 'code' => 'OJB'],
        ['name' => 'DongABank', 'code' => 'DAB'],
        ['name' => 'Woori Bank', 'code' => 'WRB'],
        ['name' => 'CBBank', 'code' => 'CBB'],
        ['name' => 'PublicBank', 'code' => 'PBB'],
    ];

    /**
     * Resolve the VietQR short code from a bank name OR an already-short code.
     * Case-insensitive. Returns null when the value is not a known bank.
     */
    public static function codeFor(string $nameOrCode): ?string
    {
        $needle = mb_strtolower(trim($nameOrCode));

        foreach (self::BANKS as $bank) {
            if (mb_strtolower($bank['name']) === $needle || mb_strtolower($bank['code']) === $needle) {
                return $bank['code'];
            }
        }

        return null;
    }

    /**
     * Resolve the canonical display name from a bank name OR short code.
     * Returns null when the value is not a known bank.
     */
    public static function canonicalName(string $nameOrCode): ?string
    {
        $needle = mb_strtolower(trim($nameOrCode));

        foreach (self::BANKS as $bank) {
            if (mb_strtolower($bank['name']) === $needle || mb_strtolower($bank['code']) === $needle) {
                return $bank['name'];
            }
        }

        return null;
    }

    /**
     * Full list of ['name' => ..., 'code' => ...] entries.
     */
    public static function all(): array
    {
        return self::BANKS;
    }
}
