using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class Subject
    {
        public int Id { get; set; }

        [Required, StringLength(50)]

        public string Name { get; set; } // Tên môn học

        public List<Teacher>? Teachers { get; set; }  // Danh sách giáo viên dạy môn hoc này
    }
}
