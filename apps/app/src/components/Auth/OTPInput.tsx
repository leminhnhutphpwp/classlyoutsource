"use client";

import React, { useRef, useEffect, useState } from "react";

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function OTPInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  className = "",
}: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Sync value prop với state
    const newOtp = value.split("").slice(0, length);
    const paddedOtp = [
      ...newOtp,
      ...new Array(length - newOtp.length).fill(""),
    ];
    setOtp(paddedOtp);
  }, [value, length]);

  const handleChange = (index: number, newValue: string) => {
    // Cho phép cả chữ và số (alphanumeric)
    // Nếu muốn chỉ cho phép chữ hoa: newValue.toUpperCase().replace(/[^A-Z0-9]/g, "")
    // Trong trường hợp HashIDs (case-sensitive), ta giữ nguyên case
    const validValue = newValue.replace(/[^a-zA-Z0-9]/g, "");

    if (validValue.length > 1) {
      // Nếu paste nhiều ký tự, xử lý paste
      handlePaste(validValue);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = validValue.slice(-1); // Chỉ lấy ký tự cuối cùng
    setOtp(newOtp);

    // Gộp tất cả các giá trị thành string và gọi onChange
    const otpString = newOtp.join("");
    onChange(otpString);

    // Tự động focus sang ô tiếp theo nếu có giá trị
    if (validValue && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (pastedValue: string) => {
    const validValue = pastedValue.replace(/[^a-zA-Z0-9]/g, "").slice(0, length);
    const newOtp = new Array(length).fill("");

    for (let i = 0; i < validValue.length && i < length; i++) {
      newOtp[i] = validValue[i];
    }

    setOtp(newOtp);
    onChange(newOtp.join(""));

    // Focus vào ô cuối cùng đã điền hoặc ô đầu tiên nếu chưa điền gì
    const nextIndex = Math.min(validValue.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Nếu ô hiện tại trống, focus về ô trước và xóa
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        onChange(newOtp.join(""));
      } else {
        // Xóa ô hiện tại
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
        onChange(newOtp.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    inputRefs.current[index]?.select();
  };

  return (
    <div className={`flex gap-1.5 justify-center w-fit max-w-xs mx-auto ${className}`}>
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="text"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={() => handleFocus(index)}
          onPaste={(e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData("text");
            handlePaste(pastedData);
          }}
          disabled={disabled}
          className="w-10 h-10 text-center text-base font-semibold rounded-md border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed !p-0"
        />
      ))}
    </div>
  );
}

