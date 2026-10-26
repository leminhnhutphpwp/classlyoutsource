<?php

namespace Tests\Unit;

use App\Support\VietQrBank;
use PHPUnit\Framework\TestCase;

class VietQrBankTest extends TestCase
{
    public function test_code_for_resolves_display_names_to_vietqr_codes(): void
    {
        $this->assertSame('TCB', VietQrBank::codeFor('Techcombank'));
        $this->assertSame('VCB', VietQrBank::codeFor('Vietcombank'));
        $this->assertSame('MB', VietQrBank::codeFor('MBBank'));
        $this->assertSame('ACB', VietQrBank::codeFor('ACB'));
        $this->assertSame('VPB', VietQrBank::codeFor('VPBank'));
        $this->assertSame('STB', VietQrBank::codeFor('Sacombank'));
    }

    public function test_code_for_is_case_insensitive(): void
    {
        $this->assertSame('TCB', VietQrBank::codeFor('techcombank'));
        $this->assertSame('VCB', VietQrBank::codeFor('VIETCOMBANK'));
        $this->assertSame('MB', VietQrBank::codeFor('  mbbank  '));
    }

    public function test_code_for_accepts_code_as_input(): void
    {
        $this->assertSame('TCB', VietQrBank::codeFor('TCB'));
        $this->assertSame('VCB', VietQrBank::codeFor('VCB'));
        $this->assertSame('MB', VietQrBank::codeFor('MB'));
    }

    public function test_code_for_returns_null_for_unknown_bank(): void
    {
        $this->assertNull(VietQrBank::codeFor('Ngân hàng không tồn tại'));
        $this->assertNull(VietQrBank::codeFor('XYZ'));
        $this->assertNull(VietQrBank::codeFor(''));
    }

    public function test_canonical_name_returns_display_name(): void
    {
        $this->assertSame('Techcombank', VietQrBank::canonicalName('TCB'));
        $this->assertSame('Techcombank', VietQrBank::canonicalName('techcombank'));
        $this->assertSame('Vietcombank', VietQrBank::canonicalName('VCB'));
    }

    public function test_canonical_name_returns_null_for_unknown(): void
    {
        $this->assertNull(VietQrBank::canonicalName('Unknown Bank'));
    }

    public function test_all_returns_complete_list(): void
    {
        $banks = VietQrBank::all();
        $this->assertGreaterThanOrEqual(20, count($banks));
        foreach ($banks as $bank) {
            $this->assertArrayHasKey('name', $bank);
            $this->assertArrayHasKey('code', $bank);
            $this->assertNotSame('', $bank['name']);
            $this->assertNotSame('', $bank['code']);
        }
    }
}
