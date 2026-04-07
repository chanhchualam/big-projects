using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class MajorFavorite
    {
        public int Id { get; set; }

        [Required]
        public int MajorId { get; set; }
        public Major Major { get; set; } = null!;

        [Required]
        public int StudentProfileId { get; set; }
        public StudentProfile StudentProfile { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}

