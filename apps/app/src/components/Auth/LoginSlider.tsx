"use client";
import Image from "next/image";

export default function LoginSlider() {
    return (
        <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#2C5F6F] to-[#1a3d47]">
            {/* Static Background Illustration */}
            <div className="absolute inset-0">
                <Image
                    src="/images/login-illustration.png"
                    alt="Education Platform Illustration"
                    fill
                    className="hidden lg:block object-cover"
                    priority
                />
            </div>

            {/* Content */}
            <div className="absolute inset-0 z-10 hidden lg:flex flex-col justify-end p-8 lg:p-12 pb-20 text-white">
                {/* Empty - No content overlay */}
            </div>
        </div>
    );
}
