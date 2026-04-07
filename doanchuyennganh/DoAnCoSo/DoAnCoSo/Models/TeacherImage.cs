namespace DoAnCoSo.Models
{
    public class TeacherImage
    {
        public int Id { get; set; }

        public string Url { get; set; }  // Đường dẫn ảnh

        public int TeacherId { get; set; }
        public Teacher? Teacher { get; set; }  // Tham chiếu đến giáo viên
    }
}
