using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class CareerTestResult
    {
        public int Id { get; set; }

        [Required]
        public int StudentProfileId { get; set; }
        public StudentProfile StudentProfile { get; set; } = null!;

        [StringLength(50)]
        public string? HollandCode { get; set; } // R, I, A, S, E, C

        [StringLength(500)]
        public string? RecommendedMajors { get; set; } // Danh sách ngành được gợi ý (JSON)

        [StringLength(2000)]
        public string? TestAnswers { get; set; } // Câu trả lời của bài test (JSON)

        [StringLength(1000)]
        public string? Analysis { get; set; } // Phân tích kết quả

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}

