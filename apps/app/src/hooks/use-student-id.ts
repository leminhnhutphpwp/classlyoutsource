import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { useApi } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { getObjId, idsEqual } from "@/lib/id-utils";

const STORAGE_KEY_PREFIX = "classly:student-id";

/**
 * Hook to get current student ID from logged in user
 * For students, it finds the student record linked to their user_id
 */
export function useStudentId() {
  const { user } = useAuthContext();
  const storageKey = getObjId(user) ? `${STORAGE_KEY_PREFIX}:${getObjId(user)}` : null;

  const [studentId, setStudentId] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !storageKey) return null;
    return sessionStorage.getItem(storageKey);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!storageKey) {
      // Clear generic storage when user logs out
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}`);
      return;
    }
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      setStudentId(stored);
    }
  }, [storageKey]);

  // Fetch student by user_id if user is a student
  // Backend applies data isolation, so students will only see their own record
  const { data: studentsData, loading } = useApi(
    () => apiClient.getStudents(),
    [],
    false, // Don't auto redirect on auth error - let parent handle it
    user?.role === 'student' && !!getObjId(user) && !studentId && !user?.student_id
  );

  useEffect(() => {
    if (!user || user.role !== 'student') {
      setStudentId(null);
      if (typeof window !== 'undefined' && storageKey) {
        sessionStorage.removeItem(storageKey);
      }
      return;
    }

    if (user.student_id) {
      const idStr = getObjId(user.student_id);
      setStudentId(idStr);
      if (typeof window !== 'undefined' && storageKey) {
        sessionStorage.setItem(storageKey, idStr);
      }
    }
  }, [user, storageKey]);

  useEffect(() => {
    if (studentId || loading || !studentsData) return;

    // Find student record by user_id from students list
    let studentsArray: any[] = [];

    if (Array.isArray(studentsData)) {
      studentsArray = studentsData;
    } else if (studentsData?.data && Array.isArray(studentsData.data)) {
      studentsArray = studentsData.data;
    }

    if (studentsArray.length === 0) return;

    const userIdStr = getObjId(user);
    const resolvedStudent =
      studentsArray.length === 1
        ? studentsArray[0]
        : studentsArray.find((s: any) => idsEqual(s.user_id, userIdStr));

    const studentIdStr = getObjId(resolvedStudent);
    if (studentIdStr) {
      const idStr = studentIdStr;
      setStudentId(idStr);
      if (typeof window !== 'undefined' && storageKey) {
        sessionStorage.setItem(storageKey, idStr);
      }
    }
  }, [studentsData, loading, studentId, storageKey, user]);

  return {
    studentId,
    loading: user?.role === 'student' && !studentId && loading,
  };
}

/**
 * Hook to get current student data
 * For students, it fetches their student record
 */
export function useCurrentStudent() {
  const { user } = useAuthContext();
  const { studentId, loading: studentIdLoading } = useStudentId();

  // Fetch student data if we have studentId
  const { data: studentData, loading: studentLoading, error } = useApi(
    () => apiClient.getStudent(studentId || ''),
    [studentId],
    true,
    !!studentId && user?.role === 'student'
  );

  return {
    student: studentData?.data || null,
    studentId: studentId || (studentData?.data ? getObjId(studentData.data) : null),
    loading: studentIdLoading || studentLoading,
    error,
  };
}
