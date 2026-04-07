using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DoAnCoSo.Models
{
    public class AdmissionScore
    {
        public int Id { get; set; }

        [Required]
        public int MajorId { get; set; }
        public Major Major { get; set; } = null!;

        [Required]
        public int UniversityId { get; set; }
        public University University { get; set; } = null!;

        [Required]
        public int ExamBlockId { get; set; }
        public ExamBlock ExamBlock { get; set; } = null!;

        [Required]
        public int Year { get; set; } // Năm tuyển sinh (2024, 2023...)

        [Required]
        [Column(TypeName = "decimal(4,2)")]
        public decimal Score { get; set; } // Điểm chuẩn

        public int? Quota { get; set; } // Chỉ tiêu

        [StringLength(500)]
        public string? Notes { get; set; } // Ghi chú

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}

