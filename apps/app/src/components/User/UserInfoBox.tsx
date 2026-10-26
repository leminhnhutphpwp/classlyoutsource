"use client";

import { EnvelopeIcon, CheckBadgeIcon, PhoneIcon, HashtagIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon as CheckBadgeIconSolid } from "@heroicons/react/24/solid";
import Tooltip from "@/components/Common/Tooltip";

interface UserInfoBoxProps {
    name: string;
    email: string;
    emailVerified?: boolean;
    avatar?: string; // Avatar URL
    avatarUrl?: string; // Alternative prop name for avatar URL
    phone?: string;
    role?: string;
    showRole?: boolean;
    studentCode?: string; // Student code
    size?: "sm" | "md" | "lg";
    className?: string;
    layout?: "horizontal" | "vertical";
}

const roleLabels: Record<string, { label: string; color: string }> = {
    tutor: { label: "Gia sư", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    student: { label: "Học viên", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    parent: { label: "Phụ huynh", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
    admin: { label: "Quản trị", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
    super_admin: { label: "Super Admin", color: "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" },
};

const sizeClasses = {
    sm: {
        name: "text-sm font-medium",
        email: "text-xs",
        icon: "h-3.5 w-3.5",
        badge: "h-3.5 w-3.5",
        roleText: "text-xs px-1.5 py-0.5",
        avatar: "h-12 w-12 text-sm", // 48px (tăng từ 40px)
    },
    md: {
        name: "text-base font-semibold",
        email: "text-sm",
        icon: "h-4 w-4",
        badge: "h-4 w-4",
        roleText: "text-xs px-2 py-0.5",
        avatar: "h-14 w-14 text-lg", // 56px
    },
    lg: {
        name: "text-lg font-bold",
        email: "text-base",
        icon: "h-5 w-5",
        badge: "h-5 w-5",
        roleText: "text-sm px-2.5 py-1",
        avatar: "h-20 w-20 text-xl", // 80px
    },
};

/**
 * UserInfoBox - Reusable component to display user information
 * 
 * Features:
 * - Display user name with email verification badge
 * - Show email with icon
 * - Optional role label
 * - Configurable size and layout
 * 
 * @example
 * ```tsx
 * <UserInfoBox 
 *   name="Nguyễn Văn A" 
 *   email="nguyenvana@gmail.com"
 *   emailVerified={true}
 *   role="tutor"
 *   showRole={true}
 * />
 * ```
 */
export default function UserInfoBox({
    name,
    email,
    emailVerified = false,
    phone,
    avatar,
    avatarUrl,
    role,
    showRole = false,
    studentCode,
    size = "md",
    className = "",
    layout = "vertical",
}: UserInfoBoxProps) {
    const sizes = sizeClasses[size];
    const roleInfo = role ? roleLabels[role] : null;
    const displayAvatar = avatar || avatarUrl;
    const initials = name.charAt(0).toUpperCase();

    if (layout === "horizontal") {
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                {/* Avatar */}
                <div className={`${sizes.avatar} rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                    {displayAvatar ? (
                        <img
                            src={displayAvatar}
                            alt={name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                            {initials}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`${sizes.name} text-gray-900 dark:text-white break-words`}>
                            {name}
                        </span>
                        {emailVerified ? (
                            <Tooltip label="Email đã xác thực">
                                <CheckBadgeIconSolid
                                    className={`${sizes.badge} text-blue-500 dark:text-blue-400 flex-shrink-0`}
                                />
                            </Tooltip>
                        ) : (
                            <Tooltip label="Email chưa xác thực">
                                <CheckBadgeIcon
                                    className={`${sizes.badge} text-gray-400 dark:text-gray-600 flex-shrink-0`}
                                />
                            </Tooltip>
                        )}
                        {showRole && roleInfo && (
                            <span className={`${sizes.roleText} rounded-full ${roleInfo.color} font-medium flex-shrink-0`}>
                                {roleInfo.label}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                        {email && (
                            <div className="flex items-center gap-1.5">
                                <EnvelopeIcon className={`${sizes.icon} text-gray-400 dark:text-gray-500 flex-shrink-0`} />
                                <span className={`${sizes.email} text-gray-600 dark:text-gray-400 break-all`}>
                                    {email}
                                </span>
                            </div>
                        )}
                        {phone && (
                            <div className="flex items-center gap-1.5">
                                <PhoneIcon className={`${sizes.icon} text-gray-400 dark:text-gray-500 flex-shrink-0`} />
                                <span className={`${sizes.email} text-gray-600 dark:text-gray-400 break-all`}>
                                    {phone}
                                </span>
                            </div>
                        )}
                        {studentCode && (
                            <div className="flex items-center gap-1.5">
                                <HashtagIcon className={`${sizes.icon} text-gray-400 dark:text-gray-500 flex-shrink-0`} />
                                <span className={`${sizes.email} text-gray-600 dark:text-gray-400`}>
                                    {studentCode}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center ${className}`}>
            {/* Avatar */}
            <div className={`${sizes.avatar} rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden mb-2`}>
                {displayAvatar ? (
                    <img
                        src={displayAvatar}
                        alt={name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                        {initials}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className={`${sizes.name} text-gray-900 dark:text-white text-center`}>
                    {name}
                </span>
                {studentCode && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">
                        #{studentCode}
                    </span>
                )}
                {emailVerified ? (
                    <Tooltip label="Email đã xác thực">
                        <CheckBadgeIconSolid
                            className={`${sizes.badge} text-blue-500 dark:text-blue-400 flex-shrink-0`}
                        />
                    </Tooltip>
                ) : (
                    <Tooltip label="Email chưa xác thực">
                        <CheckBadgeIcon
                            className={`${sizes.badge} text-gray-400 dark:text-gray-600 flex-shrink-0`}
                        />
                    </Tooltip>
                )}
                {showRole && roleInfo && (
                    <span className={`${sizes.roleText} rounded-full ${roleInfo.color} font-medium`}>
                        {roleInfo.label}
                    </span>
                )}
            </div>
            <div className="flex flex-col gap-1 mt-1 w-full items-center">
                {email && (
                    <div className="flex items-center gap-1.5 w-full justify-center">
                        <EnvelopeIcon className={`${sizes.icon} text-gray-400 dark:text-gray-500 flex-shrink-0`} />
                        <span className={`${sizes.email} text-gray-600 dark:text-gray-400 break-all text-center`}>
                            {email}
                        </span>
                    </div>
                )}
                {phone && (
                    <div className="flex items-center gap-1.5 w-full justify-center">
                        <PhoneIcon className={`${sizes.icon} text-gray-400 dark:text-gray-500 flex-shrink-0`} />
                        <span className={`${sizes.email} text-gray-600 dark:text-gray-400 text-center`}>
                            {phone}
                        </span>
                    </div>
                )}
                {studentCode && (
                    <div className="flex items-center gap-1.5 w-full justify-center">
                        <HashtagIcon className={`${sizes.icon} text-gray-400 dark:text-gray-500 flex-shrink-0`} />
                        <span className={`${sizes.email} text-gray-600 dark:text-gray-400 text-center`}>
                            {studentCode}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
