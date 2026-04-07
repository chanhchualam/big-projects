using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class Major
    {
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } // Tên ngành học

        [StringLength(20)]
        public string? Code { get; set; } // Mã ngành

        [Required]
        public string Description { get; set; } // Mô tả chi tiết về ngành học

        [StringLength(1000)]
        public string? MainSubjects { get; set; } // Các môn học chính (JSON hoặc text)

        public int Duration { get; set; } // Thời gian đào tạo (năm)

        public decimal? TuitionFee { get; set; } // Học phí ước tính (VNĐ/năm)

        [StringLength(2000)]
        public string? CareerOpportunities { get; set; } // Cơ hội việc làm

        [StringLength(500)]
        public string? AverageSalary { get; set; } // Mức lương trung bình

        [StringLength(500)]
        public string? RequiredQualities { get; set; } // Tố chất cần có

        public string? ImageUrl { get; set; } // Hình ảnh minh họa

        // Quan hệ với các bảng khác
        public List<AdmissionScore> AdmissionScores { get; set; } = new();
        public List<MajorFavorite> Favorites { get; set; } = new();
    }
}

