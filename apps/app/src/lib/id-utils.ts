/**
 * ID Utilities for HashIDs Support
 *
 * Backend has migrated to HashIDs — opaque strings over the `0-9a-z` alphabet
 * (see apps/api/config/hashids.php), variable length (e.g. "bqkwgdaljvn4yn39x2p5zy4m").
 * They are NOT fixed-length hex. Treat public IDs as strings and compare with
 * getObjId/idsEqual — never with numeric equality or arithmetic.
 */

/**
 * Get ID from object regardless of naming convention
 * Supports both HashIDs (_id) and legacy IDs (id)
 * 
 * @param obj - Object, string, or number to extract ID from
 * @returns String representation of the ID
 * 
 * @example
 * getObjId({ _id: "abc123" }) // "abc123"
 * getObjId({ id: 123 }) // "123"
 * getObjId("abc123") // "abc123"
 * getObjId(null) // ""
 */
export const getObjId = (obj: any): string => {
    if (!obj) return "";
    if (typeof obj === "string" || typeof obj === "number") return String(obj);
    return String(obj._id || obj.id || "");
};

/**
 * Extract IDs from array of objects
 * 
 * @param items - Array of objects to extract IDs from
 * @returns Array of ID strings, filtered to remove empty values
 * 
 * @example
 * extractIds([{ _id: "abc" }, { id: "def" }]) // ["abc", "def"]
 * extractIds([{ _id: "abc" }, null, { id: "" }]) // ["abc"]
 */
export const extractIds = (items: any[]): string[] => {
    if (!Array.isArray(items)) return [];
    return items.map(getObjId).filter(Boolean);
};

/**
 * Find object in array by ID (supports both _id and id)
 * 
 * @param items - Array to search in
 * @param targetId - ID to search for
 * @returns Found object or undefined
 * 
 * @example
 * findById([{ _id: "abc" }, { id: "def" }], "abc") // { _id: "abc" }
 */
export const findById = <T = any>(items: any[], targetId: string | number): T | undefined => {
    if (!Array.isArray(items) || !targetId) return undefined;
    const targetIdStr = String(targetId);
    return items.find((item) => getObjId(item) === targetIdStr);
};

/**
 * Check if two IDs are equal (handles both _id and id)
 * 
 * @param id1 - First ID (object, string, or number)
 * @param id2 - Second ID (object, string, or number)
 * @returns True if IDs match
 * 
 * @example
 * idsEqual({ _id: "abc" }, "abc") // true
 * idsEqual({ id: 123 }, 123) // true
 * idsEqual("abc", "def") // false
 */
export const idsEqual = (id1: any, id2: any): boolean => {
    const str1 = getObjId(id1);
    const str2 = getObjId(id2);
    return str1 !== "" && str1 === str2;
};

/**
 * Filter array to remove items with undefined or invalid IDs
 * 
 * @param items - Array to filter
 * @returns Filtered array with only valid ID items
 */
export const filterValidIds = <T = any>(items: T[]): T[] => {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => {
        const id = getObjId(item);
        return id && id !== "undefined" && id !== "null";
    });
};
