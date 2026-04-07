using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class ExamBlock
    {
        public int Id { get; set; }

        [Required]
        [StringLength(10)]
        public string Code { get; set; } // Mã khối: A, A1, B, C, D...

        [Required]
        [StringLength(100)]
        public string Name { get; set; } // Tên khối: Khối A, Khối B...

        [StringLength(200)]
        public string? Subjects { get; set; } // Các môn thi (Toán, Lý, Hóa...)

        [StringLength(500)]
        public string? Description { get; set; } // Mô tả

        // Quan hệ
        public List<AdmissionScore> AdmissionScores { get; set; } = new();
    }
}

