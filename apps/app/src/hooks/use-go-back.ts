import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook để xử lý logic quay lại trang trước đó một cách nhất quán
 * 
 * @param fallbackUrl - URL mặc định nếu không có lịch sử trình duyệt (ví dụ: '/students')
 * @returns Hàm handleGoBack để gọi khi người dùng click nút "Quay lại"
 * 
 * @example
 * ```tsx
 * const handleGoBack = useGoBack('/students');
 * 
 * <Button onClick={handleGoBack}>Quay lại</Button>
 * ```
 */
export function useGoBack(fallbackUrl?: string) {
  const router = useRouter();

  const handleGoBack = useCallback(() => {
    // Kiểm tra xem có lịch sử trình duyệt không
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (fallbackUrl) {
      // Nếu không có lịch sử, điều hướng đến URL mặc định
      router.push(fallbackUrl);
    } else {
      // Nếu không có fallback URL, vẫn thử quay lại
      router.back();
    }
  }, [router, fallbackUrl]);

  return handleGoBack;
}

