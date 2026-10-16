# HƯỚNG DẪN TẠO MIGRATION VÀ CẬP NHẬT DATABASE

## Bước 1: Tạo Migration

Mở Terminal/PowerShell trong thư mục dự án và chạy lệnh:

```bash
dotnet ef migrations add AddMajorAndRelatedTables
```

Lệnh này sẽ tạo migration mới với tất cả các thay đổi về Model.

## Bước 2: Kiểm tra Migration

Kiểm tra file migration được tạo trong thư mục `Migrations/` để đảm bảo nó đúng như mong muốn.

## Bước 3: Cập nhật Database

Chạy lệnh để áp dụng migration vào database:

```bash
dotnet ef database update
```

## Bước 4: Thêm Dữ Liệu Mẫu (Tùy chọn)

Sau khi cập nhật database, bạn có thể thêm dữ liệu mẫu:

### Tạo dữ liệu mẫu trong Program.cs (sau khi app.Build())

```csharp
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    
    // Kiểm tra nếu đã có dữ liệu chưa
    if (!context.ExamBlocks.Any())
    {
        // Thêm các khối thi
        context.ExamBlocks.AddRange(
            new ExamBlock { Code = "A", Name = "Khối A", Subjects = "Toán, Lý, Hóa" },
            new ExamBlock { Code = "A1", Name = "Khối A1", Subjects = "Toán, Lý, Anh" },
            new ExamBlock { Code = "B", Name = "Khối B", Subjects = "Toán, Hóa, Sinh" },
            new ExamBlock { Code = "C", Name = "Khối C", Subjects = "Văn, Sử, Địa" },
            new ExamBlock { Code = "D", Name = "Khối D", Subjects = "Toán, Văn, Anh" }
        );

        // Thêm một số trường đại học mẫu
        context.Universities.AddRange(
            new University 
            { 
                Name = "Đại học Bách khoa Hà Nội", 
                Code = "BKHN",
                City = "Hà Nội",
                Type = "Công lập",
                Address = "Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội"
            },
            new University 
            { 
                Name = "Đại học Công nghệ - ĐHQG Hà Nội", 
                Code = "UET",
                City = "Hà Nội",
                Type = "Công lập",
                Address = "144 Xuân Thủy, Cầu Giấy, Hà Nội"
            }
        );

        await context.SaveChangesAsync();
    }
}
```

## Lưu Ý

1. **Backup Database**: Trước khi chạy migration, hãy backup database nếu có dữ liệu quan trọng.

2. **Connection String**: Đảm bảo connection string trong `appsettings.json` đúng.

3. **Entity Framework Tools**: Nếu gặp lỗi, cài đặt EF Tools:
   ```bash
   dotnet tool install --global dotnet-ef
   ```

4. **Kiểm tra lỗi**: Sau khi migration, kiểm tra database để đảm bảo các bảng được tạo đúng.

## Troubleshooting

- **Lỗi migration**: Xóa thư mục `Migrations/` (trừ `ApplicationDbContextModelSnapshot.cs`) và tạo lại migration.
- **Lỗi kết nối**: Kiểm tra SQL Server đang chạy và connection string đúng.
- **Lỗi permission**: Đảm bảo SQL Server user có quyền tạo bảng.

