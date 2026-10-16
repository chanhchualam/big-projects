using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Services
{
    public static class DataSeeder
    {
        public static async Task SeedDataAsync(IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

            // Ensure database is created
            await context.Database.EnsureCreatedAsync();

            // Seed Roles
            if (!await roleManager.RoleExistsAsync("Admin"))
            {
                await roleManager.CreateAsync(new IdentityRole("Admin"));
            }

            // Seed Admin User
            var adminEmail = "admin@example.com";
            if (await userManager.FindByEmailAsync(adminEmail) == null)
            {
                var admin = new ApplicationUser
                {
                    UserName = adminEmail,
                    Email = adminEmail,
                    FullName = "Administrator",
                    EmailConfirmed = true
                };
                var result = await userManager.CreateAsync(admin, "Admin@123");
                if (result.Succeeded)
                {
                    await userManager.AddToRoleAsync(admin, "Admin");
                }
            }

            // Seed Exam Blocks
            if (!await context.ExamBlocks.AnyAsync())
            {
                context.ExamBlocks.AddRange(
                    new ExamBlock { Code = "A", Name = "Khối A", Subjects = "Toán, Vật lý, Hóa học", Description = "Khối A truyền thống" },
                    new ExamBlock { Code = "A1", Name = "Khối A1", Subjects = "Toán, Vật lý, Tiếng Anh", Description = "Khối A1" },
                    new ExamBlock { Code = "B", Name = "Khối B", Subjects = "Toán, Hóa học, Sinh học", Description = "Khối B y dược" },
                    new ExamBlock { Code = "C", Name = "Khối C", Subjects = "Ngữ văn, Lịch sử, Địa lý", Description = "Khối C xã hội" },
                    new ExamBlock { Code = "D", Name = "Khối D", Subjects = "Toán, Ngữ văn, Tiếng Anh", Description = "Khối D ngoại ngữ" },
                    new ExamBlock { Code = "D1", Name = "Khối D1", Subjects = "Toán, Ngữ văn, Tiếng Anh", Description = "Khối D1" }
                );
                await context.SaveChangesAsync();
            }

            // Seed Universities
            if (!await context.Universities.AnyAsync())
            {
                context.Universities.AddRange(
                    new University
                    {
                        Name = "Đại học Bách khoa Hà Nội",
                        Code = "BKHN",
                        City = "Hà Nội",
                        Type = "Công lập",
                        Address = "Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
                        Website = "https://www.hust.edu.vn",
                        PhoneNumber = "024 3869 2224",
                        Description = "Trường đại học kỹ thuật hàng đầu Việt Nam"
                    },
                    new University
                    {
                        Name = "Đại học Công nghệ - ĐHQG Hà Nội",
                        Code = "UET",
                        City = "Hà Nội",
                        Type = "Công lập",
                        Address = "144 Xuân Thủy, Cầu Giấy, Hà Nội",
                        Website = "https://uet.vnu.edu.vn",
                        PhoneNumber = "024 3754 7793",
                        Description = "Trường đại học công nghệ uy tín"
                    },
                    new University
                    {
                        Name = "Đại học Kinh tế Quốc dân",
                        Code = "NEU",
                        City = "Hà Nội",
                        Type = "Công lập",
                        Address = "207 Giải Phóng, Hai Bà Trưng, Hà Nội",
                        Website = "https://www.neu.edu.vn",
                        PhoneNumber = "024 3628 0280",
                        Description = "Trường đại học kinh tế hàng đầu"
                    },
                    new University
                    {
                        Name = "Đại học Y Hà Nội",
                        Code = "HMU",
                        City = "Hà Nội",
                        Type = "Công lập",
                        Address = "Số 1 Tôn Thất Tùng, Đống Đa, Hà Nội",
                        Website = "https://www.hmu.edu.vn",
                        PhoneNumber = "024 3852 3791",
                        Description = "Trường đại học y dược hàng đầu Việt Nam"
                    }
                );
                await context.SaveChangesAsync();
            }

            // Seed Majors
            if (!await context.Majors.AnyAsync())
            {
                var examBlocks = await context.ExamBlocks.ToListAsync();
                var universities = await context.Universities.ToListAsync();

                var majors = new List<Major>
                {
                    new Major
                    {
                        Name = "Công nghệ thông tin",
                        Code = "CNTT",
                        Description = "Ngành học về công nghệ, phần mềm, hệ thống máy tính và ứng dụng công nghệ thông tin trong đời sống.",
                        MainSubjects = "Lập trình, Cơ sở dữ liệu, Mạng máy tính, Trí tuệ nhân tạo",
                        Duration = 4,
                        TuitionFee = 15000000,
                        CareerOpportunities = "Lập trình viên, Kỹ sư phần mềm, Chuyên gia bảo mật, Quản trị hệ thống",
                        AverageSalary = "8-20 triệu/tháng (sinh viên mới ra trường), 20-50 triệu/tháng (có kinh nghiệm)",
                        RequiredQualities = "Tư duy logic, Khả năng lập trình, Cẩn thận, Sáng tạo"
                    },
                    new Major
                    {
                        Name = "Kỹ thuật phần mềm",
                        Code = "KTPM",
                        Description = "Ngành học chuyên sâu về phát triển phần mềm, quy trình phát triển phần mềm và quản lý dự án phần mềm.",
                        MainSubjects = "Lập trình hướng đối tượng, Phát triển phần mềm, Quản lý dự án, Kiểm thử phần mềm",
                        Duration = 4,
                        TuitionFee = 16000000,
                        CareerOpportunities = "Lập trình viên Full-stack, DevOps Engineer, Scrum Master, Product Manager",
                        AverageSalary = "10-25 triệu/tháng (mới ra trường), 25-60 triệu/tháng (có kinh nghiệm)",
                        RequiredQualities = "Logic, Cẩn thận, Làm việc nhóm, Chịu áp lực"
                    },
                    new Major
                    {
                        Name = "Y khoa",
                        Code = "YK",
                        Description = "Ngành học đào tạo bác sĩ đa khoa, chẩn đoán và điều trị bệnh cho bệnh nhân.",
                        MainSubjects = "Giải phẫu, Sinh lý, Bệnh lý, Dược lý, Lâm sàng",
                        Duration = 6,
                        TuitionFee = 8000000,
                        CareerOpportunities = "Bác sĩ đa khoa, Bác sĩ chuyên khoa, Nghiên cứu y học",
                        AverageSalary = "15-30 triệu/tháng (mới ra trường), 30-100 triệu/tháng (có kinh nghiệm)",
                        RequiredQualities = "Chăm chỉ, Kiên nhẫn, Y đức, Trách nhiệm cao"
                    },
                    new Major
                    {
                        Name = "Dược học",
                        Code = "DH",
                        Description = "Ngành học về nghiên cứu, bào chế và sử dụng thuốc trong điều trị bệnh.",
                        MainSubjects = "Hóa dược, Dược lý, Bào chế, Kiểm nghiệm thuốc",
                        Duration = 5,
                        TuitionFee = 8500000,
                        CareerOpportunities = "Dược sĩ, Nghiên cứu thuốc, Kinh doanh dược phẩm",
                        AverageSalary = "8-15 triệu/tháng (mới ra trường), 15-40 triệu/tháng (có kinh nghiệm)",
                        RequiredQualities = "Cẩn thận, Chính xác, Trách nhiệm, Giao tiếp tốt"
                    },
                    new Major
                    {
                        Name = "Kinh tế",
                        Code = "KT",
                        Description = "Ngành học về các hoạt động kinh tế, quản lý nguồn lực và phân tích thị trường.",
                        MainSubjects = "Kinh tế vi mô, Kinh tế vĩ mô, Thống kê, Toán kinh tế",
                        Duration = 4,
                        TuitionFee = 12000000,
                        CareerOpportunities = "Chuyên viên kinh tế, Nhà phân tích, Tư vấn kinh tế",
                        AverageSalary = "7-15 triệu/tháng (mới ra trường), 15-35 triệu/tháng (có kinh nghiệm)",
                        RequiredQualities = "Tư duy logic, Phân tích tốt, Giao tiếp, Ngoại ngữ"
                    },
                    new Major
                    {
                        Name = "Quản trị kinh doanh",
                        Code = "QTKD",
                        Description = "Ngành học về quản lý doanh nghiệp, chiến lược kinh doanh và vận hành tổ chức.",
                        MainSubjects = "Quản trị học, Marketing, Tài chính doanh nghiệp, Quản trị nhân sự",
                        Duration = 4,
                        TuitionFee = 13000000,
                        CareerOpportunities = "Quản lý, Giám đốc, Nhà khởi nghiệp, Tư vấn kinh doanh",
                        AverageSalary = "8-18 triệu/tháng (mới ra trường), 18-50 triệu/tháng (có kinh nghiệm)",
                        RequiredQualities = "Lãnh đạo, Giao tiếp tốt, Quyết đoán, Sáng tạo"
                    }
                };

                context.Majors.AddRange(majors);
                await context.SaveChangesAsync();

                // Seed Admission Scores (sample data)
                var savedMajors = await context.Majors.ToListAsync();
                var currentYear = DateTime.Now.Year;

                var admissionScores = new List<AdmissionScore>();
                foreach (var major in savedMajors)
                {
                    foreach (var university in universities.Take(2)) // Mỗi ngành có 2 trường
                    {
                        foreach (var block in examBlocks.Take(2)) // Mỗi trường có 2 khối
                        {
                            admissionScores.Add(new AdmissionScore
                            {
                                MajorId = major.Id,
                                UniversityId = university.Id,
                                ExamBlockId = block.Id,
                                Year = currentYear,
                                Score = (decimal)(20 + new Random().NextDouble() * 8), // Điểm từ 20-28
                                Quota = 50 + new Random().Next(100)
                            });
                        }
                    }
                }

                context.AdmissionScores.AddRange(admissionScores);
                await context.SaveChangesAsync();
            }
        }
    }
}

