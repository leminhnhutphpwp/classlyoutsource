# File Mẫu Nhập Câu Hỏi Trắc Nghiệm

## Cấu trúc thư mục

- `mau-cau-hoi-trac-nghiem.csv` - File mẫu CSV (khuyến nghị)
- `mau-cau-hoi-trac-nghiem.xlsx` - File mẫu Excel
- `mau-cau-hoi-trac-nghiem.txt` - Hướng dẫn tạo file DOCX

## Cấu trúc file

### Cột bắt buộc:
1. **Câu hỏi** (hoặc "Nội dung", "Title", "Question") - Nội dung câu hỏi
2. **Phương án A, B, C, D** (hoặc "Phương án A", "Option A", "A", "B", "C", "D") - Các lựa chọn trả lời
3. **Đáp án đúng** (hoặc "Correct", "Answer", "Đúng") - Ký tự A, B, C, hoặc D
4. **Điểm** (hoặc "Points", "Score") - Số điểm (mặc định: 1)

### Ví dụ:

```csv
Câu hỏi,Phương án A,Phương án B,Phương án C,Phương án D,Đáp án đúng,Điểm
"Trắc nghiệm là gì?","Một phương pháp đánh giá","Một loại câu hỏi","Cả A và B","Không có đáp án đúng",C,1
```

## Lưu ý

- File CSV: Hỗ trợ đầy đủ, khuyến nghị sử dụng
- File Excel (.xlsx, .xls): Hỗ trợ cơ bản, có thể cần parse qua backend
- File DOCX: Chưa hỗ trợ parse tự động, vui lòng chuyển sang CSV hoặc Excel

## Hướng dẫn tạo file Excel từ CSV

1. Mở file CSV bằng Microsoft Excel hoặc Google Sheets
2. Chọn "Save As" hoặc "Lưu thành"
3. Chọn định dạng "Excel Workbook (.xlsx)"
4. Lưu file

## Hướng dẫn tạo file DOCX

File DOCX hiện chưa được hỗ trợ parse tự động. Vui lòng:
1. Sử dụng file CSV hoặc Excel thay thế
2. Hoặc chuyển đổi file DOCX sang CSV/Excel trước khi import

