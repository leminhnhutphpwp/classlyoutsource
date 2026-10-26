
import { QrCodeIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { codeForBank } from "@/lib/vietqr-banks";

interface PaymentQRCodeProps {
  qrUrl?: string;
  bankInfo?: {
    bank_name?: string;
    account_number?: string;
    account_name?: string;
    account_holder?: string; // Some APIs use account_holder
    content?: string;
    transfer_content?: string; // Some APIs use transfer_content
    qr_code_url?: string;
    branch?: string;
    swift_code?: string;
    instructions?: string;
  };
  amount?: number;
  content?: string; // Fallback content if not in bankInfo
  onCopySuccess?: (message: string) => void;
  onCopyError?: (message: string) => void;
}

export default function PaymentQRCode({
  qrUrl,
  bankInfo,
  amount,
  content,
  onCopySuccess,
  onCopyError,
}: PaymentQRCodeProps) {
  if (!bankInfo) return null;

  const transferContent = bankInfo.transfer_content || bankInfo.content || content || '';
  const accountName = bankInfo.account_name || bankInfo.account_holder;

  // Determine QR URL
  let finalQrUrl = qrUrl || bankInfo.qr_code_url;

  if (!finalQrUrl && bankInfo.account_number && bankInfo.bank_name) {
    // Generate VietQR URL fallback using canonical bank code resolver.
    const bankCode = codeForBank(bankInfo.bank_name);

    if (bankCode) {
      const amountParam = amount ? `&amount=${amount}` : '';
      finalQrUrl = `https://img.vietqr.io/image/${bankCode}-${bankInfo.account_number}-compact.jpg?addInfo=${encodeURIComponent(transferContent)}${amountParam}`;
    }
  }

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopySuccess?.(`Đã sao chép ${label}`);
    } catch {
      onCopyError?.(`Không thể sao chép ${label}`);
    }
  };

  return (
    <div className="bg-primary-pastel/20 dark:bg-primary/10 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bankInfo.bank_name && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tên ngân hàng</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {bankInfo.bank_name}
            </p>
          </div>
        )}

        {bankInfo.account_number && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Số tài khoản</p>
            <div className="flex items-center gap-2">
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {bankInfo.account_number}
              </p>
              <button
                onClick={() => handleCopy(bankInfo.account_number!, "số tài khoản")}
                className="p-1 text-gray-400 hover:text-primary transition-colors"
                title="Sao chép số tài khoản"
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {accountName && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Chủ tài khoản</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {accountName}
            </p>
          </div>
        )}

        {transferContent && (
          <div className="md:col-span-2">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Nội dung chuyển khoản</p>
            <div className="flex items-center gap-2">
              <p className="text-base font-medium text-gray-900 dark:text-white flex-1 break-all border-2 border-dashed border-primary/30 p-2 rounded bg-white dark:bg-gray-900">
                {transferContent}
              </p>
              <button
                onClick={() => handleCopy(transferContent, "nội dung chuyển khoản")}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0"
                title="Sao chép nội dung chuyển khoản"
              >
                <DocumentDuplicateIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Vui lòng copy nội dung này và paste vào app ngân hàng khi chuyển khoản
            </p>
          </div>
        )}

        {bankInfo.branch && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Chi nhánh</p>
            <p className="text-base text-gray-900 dark:text-white">
              {bankInfo.branch}
            </p>
          </div>
        )}

        {bankInfo.swift_code && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">SWIFT Code</p>
            <p className="text-base text-gray-900 dark:text-white">
              {bankInfo.swift_code}
            </p>
          </div>
        )}
      </div>

      {/* Instructions */}
      {bankInfo.instructions && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Hướng dẫn chuyển khoản:
          </p>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {bankInfo.instructions}
          </div>
        </div>
      )}

      {/* QR Code */}
      {finalQrUrl && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <QrCodeIcon className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">QR Code chuyển khoản</p>
          </div>
          <div className="flex justify-center">
            <img
              src={finalQrUrl}
              alt="QR Code chuyển khoản"
              className="max-w-xs w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
            />
          </div>
          <p className="text-center mt-2 text-xs text-gray-500 dark:text-gray-400">
            Sử dụng ứng dụng ngân hàng hoặc ví điện tử để quét mã
          </p>
        </div>
      )}
    </div>
  );
}
