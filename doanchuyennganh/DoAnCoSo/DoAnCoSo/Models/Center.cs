using System.ComponentModel.DataAnnotations;

namespace DoAnCoSo.Models
{
    public class Center
    {
        public int Id { get; set; }

        [Required, StringLength(50)]
        public string Name { get; set; }  // Tên trung tâm

        public string? Address { get; set; }  // Địa chỉ trung tâm

        public string? PhoneNumber { get; set; }   // Số điện thoại

        public string? Website { get; set; }       // Website trung tâm

        public string? Fanpage { get; set; }       // Fanpage Facebook

        public List<Teacher>? Teachers { get; set; }  // Danh sách giáo viên thuộc trung tâm
    }
}
