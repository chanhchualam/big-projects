using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class University
    {
        public int Id { get; set; }

        [Required]
        [StringLength(200)]
        public string Name { get; set; } // Tên trường

        [StringLength(20)]
        public string? Code { get; set; } // Mã trường

        [StringLength(500)]
        public string? Address { get; set; } // Địa chỉ

        [StringLength(100)]
        public string? City { get; set; } // Thành phố/Tỉnh

        [StringLength(500)]
        public string? Website { get; set; } // Website

        [StringLength(20)]
        public string? PhoneNumber { get; set; } // Số điện thoại

        [StringLength(50)]
        public string? Type { get; set; } // Loại trường: Công lập, Tư thục, Quốc tế

        public int? Ranking { get; set; } // Xếp hạng (nếu có)

        public string? Description { get; set; } // Mô tả về trường

        public string? LogoUrl { get; set; } // Logo trường

        // Quan hệ
        public List<AdmissionScore> AdmissionScores { get; set; } = new();
    }
}

