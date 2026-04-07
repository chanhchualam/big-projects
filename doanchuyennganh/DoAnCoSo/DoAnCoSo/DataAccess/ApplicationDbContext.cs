using DoAnCoSo.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.DataAccess
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Teacher> Teachers { get; set; }
        public DbSet<Center> Centers { get; set; }
        public DbSet<TeacherImage> TeacherImages { get; set; }
        public DbSet<Subject> Subjects { get; set; } // Danh sách môn học
        public DbSet<Review> Reviews { get; set; }

        // Các bảng mới cho hệ thống gợi ý ngành học
        public DbSet<Major> Majors { get; set; }
        public DbSet<University> Universities { get; set; }
        public DbSet<ExamBlock> ExamBlocks { get; set; }
        public DbSet<AdmissionScore> AdmissionScores { get; set; }
        public DbSet<StudentProfile> StudentProfiles { get; set; }
        public DbSet<MajorFavorite> MajorFavorites { get; set; }
        public DbSet<CareerTestResult> CareerTestResults { get; set; }

        public Task<List<string>> GetDistinctUniversityCitiesAsync() =>
            Universities
                .Where(u => !string.IsNullOrEmpty(u.City))
                .Select(u => u.City!)
                .Distinct()
                .ToListAsync();
    }
}
