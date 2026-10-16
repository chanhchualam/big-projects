using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace DoAnCoSo.Models
{
    public class StudentProfile
    {
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        [StringLength(200)]
        public string? HighSchoolName { get; set; } // Tên trường THPT

        [StringLength(100)]
        public string? City { get; set; } // Tỉnh/Thành phố

        [Column(TypeName = "decimal(3,2)")]
        public decimal? MathScore { get; set; } // Điểm Toán

        [Column(TypeName = "decimal(3,2)")]
        public decimal? PhysicsScore { get; set; } // Điểm Lý

        [Column(TypeName = "decimal(3,2)")]
        public decimal? ChemistryScore { get; set; } // Điểm Hóa

        [Column(TypeName = "decimal(3,2)")]
        public decimal? LiteratureScore { get; set; } // Điểm Văn

        [Column(TypeName = "decimal(3,2)")]
        public decimal? HistoryScore { get; set; } // Điểm Sử

        [Column(TypeName = "decimal(3,2)")]
        public decimal? GeographyScore { get; set; } // Điểm Địa

        [Column(TypeName = "decimal(3,2)")]
        public decimal? EnglishScore { get; set; } // Điểm Anh

        [Column(TypeName = "decimal(4,2)")]
        public decimal? ExpectedScore { get; set; } // Điểm dự kiến thi THPT

        [StringLength(1000)]
        public string? Interests { get; set; } // Sở thích (JSON hoặc comma-separated)

        [StringLength(500)]
        public string? CareerGoal { get; set; } // Mục tiêu nghề nghiệp

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }

        // Quan hệ
        public List<MajorFavorite> Favorites { get; set; } = new();
        public List<CareerTestResult> TestResults { get; set; } = new();
    }
}

