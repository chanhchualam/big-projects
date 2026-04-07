using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class Teacher
    {
        public int Id { get; set; }

        [Required, StringLength(100)]
        public string Name { get; set; }  // Tên giáo viên

        [StringLength(100)]
        public string? Subject { get; set; }  // Môn dạy (có thể null nếu chưa rõ)

        [Range(0,5)]
        public string? Gender { get; set; }         // Giới tính

        public string? Description { get; set; }  // Mô tả về giáo viên

        public string? ImageUrl { get; set; }  // Ảnh đại diện (ảnh chính)

        public List<TeacherImage>? Images { get; set; }  // Danh sách các ảnh liên quan

        public int CenterId { get; set; }  // Mã trung tâm
        public Center? Center { get; set; }  // Thông tin trung tâm
        public List<Review>? Reviews { get; set; }  // Danh sách đánh giá của giáo viên
    }
}
