using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class Review
    {
        public int Id { get; set; }

        [Required]
        public string Content { get; set; }

        [Range(1, 5)]
        public int Rating { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Foreign Keys
        public string UserId { get; set; } // học sinh (AspNetUsers)
        public int TeacherId { get; set; }

        // Navigation
        public ApplicationUser User { get; set; }
        public Teacher Teacher { get; set; }
    }

}
