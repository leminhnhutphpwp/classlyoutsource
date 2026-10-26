"use client";

import { useEffect, useState } from "react";

/**
 * Component để ẩn NextTopLoader khi BootstrapLoader đang hiển thị
 */
export default function TopLoaderController() {
  const [hideTopLoader, setHideTopLoader] = useState(false);

  useEffect(() => {
    // Trạng thái chính điều khiển bằng event start/end. Việc poll DOM chỉ là
    // fallback cho các nhánh không phát 'bootstrap:end' (lỗi/skip) và chỉ chạy
    // trong lúc handoff, không phải một timer 100ms suốt phiên. Xem note F3.
    let interval: ReturnType<typeof setInterval> | null = null;

    const checkBootstrapLoader = () => {
      const bootstrapElement = document.querySelector('[data-bootstrap-loader]');
      setHideTopLoader(!!bootstrapElement);
      if (!bootstrapElement && interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleBootstrapStart = () => {
      setHideTopLoader(true);
      if (!interval) {
        interval = setInterval(checkBootstrapLoader, 100);
      }
    };
    const handleBootstrapEnd = () => setHideTopLoader(false);

    window.addEventListener('bootstrap:start', handleBootstrapStart);
    window.addEventListener('bootstrap:end', handleBootstrapEnd);

    // Kiểm tra ngay khi mount (phòng trường hợp loader đã tồn tại sẵn)
    checkBootstrapLoader();

    return () => {
      window.removeEventListener('bootstrap:start', handleBootstrapStart);
      window.removeEventListener('bootstrap:end', handleBootstrapEnd);
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Ẩn/hiện NextTopLoader bằng CSS
    // NextTopLoader tạo element với id "nprogress" hoặc class "nprogress"
    const topLoaderElements = [
      document.getElementById('nprogress'),
      document.querySelector('.nprogress'),
      document.querySelector('[role="progressbar"]')?.parentElement,
    ].filter(Boolean) as HTMLElement[];

    topLoaderElements.forEach((element) => {
      if (hideTopLoader) {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
      } else {
        element.style.display = '';
        element.style.visibility = '';
        element.style.opacity = '';
      }
    });

    // Thêm CSS class vào body để có thể dùng CSS selector
    if (hideTopLoader) {
      document.body.classList.add('bootstrap-loading');
    } else {
      document.body.classList.remove('bootstrap-loading');
    }
  }, [hideTopLoader]);

  return null;
}

