import { NextRequest, NextResponse } from 'next/server';
import { handleBackendRequest } from '@/lib/api-route-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleBackendRequest(request, 'GET', `/api/v1/learning-resources/${id}`, { requireAuth: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Handle POST with _method=PUT (method spoofing for file upload)
  // Laravel/PHP không nhận được file từ PUT request, cần dùng POST với _method=PUT
  const { id } = await params;
  const contentType = request.headers.get('content-type') || '';
  
  let body: FormData | any;
  
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      
      // Ensure _method=PUT is present for Laravel method spoofing
      if (!formData.has('_method')) {
        formData.append('_method', 'PUT');
      }
      
      body = formData;
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          message: error instanceof Error ? error.message : 'Lỗi khi xử lý FormData' 
        },
        { status: 400 }
      );
    }
  } else {
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          message: error instanceof Error ? error.message : 'Lỗi khi xử lý request' 
        },
        { status: 400 }
      );
    }
  }
  
  return handleBackendRequest(request, 'POST', `/api/v1/learning-resources/${id}`, {
    requireAuth: true,
    body,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // PUT handler chỉ dùng cho JSON updates (không có file)
  // File uploads nên dùng POST với _method=PUT
  const { id } = await params;
  
  let body: any;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Lỗi khi xử lý request' 
      },
      { status: 400 }
    );
  }
  
  return handleBackendRequest(request, 'PUT', `/api/v1/learning-resources/${id}`, {
    requireAuth: true,
    body,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleBackendRequest(request, 'DELETE', `/api/v1/learning-resources/${id}`, { requireAuth: true });
}
