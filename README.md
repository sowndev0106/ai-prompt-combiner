# AI Prompt Combiner

Extension này giúp bạn dễ dàng chọn nhiều file và thư mục để tổng hợp nội dung của chúng vào một file prompt duy nhất cho AI.

## Tính năng

- Giao diện dạng cây trực quan để chọn file và thư mục.
- Tự động tạo sơ đồ cấu trúc thư mục trong file output.
- Tổng hợp nội dung các file đã chọn vào file `combined_prompt.txt`.
- Bỏ qua các file và thư mục không cần thiết như `node_modules`, `.git`, `target`...

## Cách sử dụng

1. Nhấn vào icon "AI Prompt Combiner" trên thanh công cụ bên trái.
2. Trong khung nhìn "Project Files", nhấn nút `+` trên các file/thư mục bạn muốn thêm.
3. Các mục đã chọn sẽ xuất hiện trong khung nhìn "Selected for Prompt" bên dưới.
4. Nhấn vào nút "Compile to Prompt" trên thanh tiêu đề của khung nhìn "Selected for Prompt".
5. File `combined_prompt.txt` sẽ được tạo ở thư mục gốc của dự án.